import "server-only"
import OpenAI from "openai"
import type { Tool } from "openai/resources/responses/responses"
import { buildSystemPrompt } from "./prompt"
import { TOOL_DEFINITIONS, executeTool, type ToolResult } from "./tools"
import { loadAgentContext } from "./state"

/**
 * Run one turn of the WhatsApp concierge agent.
 *
 * Inputs:
 *   • conversationId — webhook hands this in after persisting the
 *     inbound message + (re)solving the lead.
 *
 * Outputs:
 *   • assistantReply  — text to send via Twilio (already trimmed for
 *                       WhatsApp's 1600-char limit; the send helper
 *                       trims again defensively).
 *   • tool_calls_made — count, for logging/observability.
 *   • iterations      — how many model→tool loops we did.
 *
 * Why we DON'T pass `previous_response_id` for state chaining:
 *   • Storing the response_id on `conversations` would tie us to
 *     OpenAI's 30-day retention. If a lead pings us after a month,
 *     the chain breaks.
 *   • Our message history is in our own DB; passing it on each turn
 *     gives us provider portability + lets us swap the model without
 *     losing context.
 *   • Cost is the same — the API tokenizes whatever input we send,
 *     either way.
 *
 * Loop hard cap is 5: model → tool → model → tool → model. Any more
 * is almost certainly a runaway (model loops on the same tool); we
 * bail with whatever the last assistant text was, or a graceful
 * fallback.
 */

const MAX_ITERATIONS = 5
const MODEL          = "gpt-4o-mini"   // matches the rest of the codebase

let openaiClient: OpenAI | null = null
function getClient(): OpenAI {
  if (openaiClient) return openaiClient
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY not set")
  openaiClient = new OpenAI({ apiKey })
  return openaiClient
}

export interface AgentTurnResult {
  /** Text to send to the lead, OR `null` when the agent chose to stay
   *  silent (e.g. lead said "ok" and there's nothing useful to add).
   *  The webhook treats `null` as "don't send anything; conversation
   *  pauses until the lead writes back". */
  reply:           string | null
  toolCallsMade:   number
  iterations:      number
  /** True when we hit MAX_ITERATIONS without a final assistant text.
   *  Useful for observability — if this fires regularly, the loop or
   *  prompt is unhealthy. */
  hitCap:          boolean
}

export async function runAgentTurn(conversationId: string): Promise<AgentTurnResult> {
  // ── Context ──────────────────────────────────────────────────
  const ctx = await loadAgentContext(conversationId)
  const client = getClient()

  // ── Message history → Responses API input array ──────────────
  // Responses API takes an `input` array where each item is either:
  //   { role: 'user' | 'assistant', content: string }
  //   { role: 'developer', content: string }   ← system-equivalent
  //   tool call / function output items (we add these inside the loop)
  // We render history as plain user/assistant turns; the system
  // prompt rides in the `instructions` param so it's not chained
  // into the message array.
  const input: ResponsesInputItem[] = ctx.messages
    .filter((m) => m.content && m.content.trim().length > 0)
    .map((m) => ({
      role:    m.direction === "inbound" ? "user" : "assistant",
      content: m.content,
    }))

  const instructions = buildSystemPrompt(ctx)

  // ── Iteration loop ───────────────────────────────────────────
  let toolCallsMade = 0
  let iterations    = 0
  let finalReply: string | null = null

  while (iterations < MAX_ITERATIONS) {
    iterations += 1

    const response = await client.responses.create({
      model:        MODEL,
      instructions,
      input,
      tools:        TOOL_DEFINITIONS as unknown as Tool[],
      // We let the model decide whether to call tools. Forcing
      // tool_choice would block the model from sending a plain
      // reply when no tool is needed (e.g. "ok, gracias").
      tool_choice:  "auto",
      // Soft cap so a runaway response can't burn money. Roughly
      // 1500 chars of Spanish text fits comfortably.
      max_output_tokens: 600,
    })

    // Collect any tool calls + the final text in this response.
    const toolCalls: Array<{ id: string; name: string; args: unknown }> = []
    let textBuf = ""

    for (const item of response.output ?? []) {
      if (item.type === "function_call") {
        let parsedArgs: unknown
        try {
          parsedArgs = JSON.parse(item.arguments ?? "{}")
        } catch {
          parsedArgs = {}
        }
        toolCalls.push({ id: item.call_id, name: item.name, args: parsedArgs })
      } else if (item.type === "message") {
        // Aggregate any output_text parts within the message.
        for (const part of item.content ?? []) {
          if (part.type === "output_text") textBuf += part.text
        }
      }
    }

    // No tool calls → this is the final assistant turn.
    if (toolCalls.length === 0) {
      finalReply = textBuf.trim()
      break
    }

    // Execute tools sequentially. Sequential is fine — most turns
    // have ≤ 2 tool calls and the DB operations are sub-50ms each.
    // We append the function_call AND its output to `input` so the
    // model can see both on the next iteration.
    for (const call of toolCalls) {
      toolCallsMade += 1
      const result: ToolResult = await executeTool(call.name, call.args, ctx)

      input.push({
        type:      "function_call",
        call_id:   call.id,
        name:      call.name,
        arguments: JSON.stringify(call.args),
      })
      input.push({
        type:    "function_call_output",
        call_id: call.id,
        output:  JSON.stringify(result),
      })
    }
  }

  // Loop cap hit without a clean exit → graceful fallback. This is the
  // only case where we make up a reply the model didn't write; it's a
  // bug signal we want visible to the user instead of silence.
  if (finalReply == null) {
    return {
      reply:         "Disculpá, me trabé un momento. ¿Me lo podés repetir?",
      toolCallsMade,
      iterations,
      hitCap:        true,
    }
  }

  // Empty reply with no tool calls = model unexpectedly went silent.
  // We used to treat this as "intentional silence" but that backfired
  // when the lead's "ok" was actually a confirmation to a question
  // the bot had just asked — leaving the lead on read mid-flow. Now
  // the prompt always requires a reply, and we surface a graceful
  // fallback if the model still returns nothing.
  if (!finalReply) {
    return {
      reply:         "Disculpá, no entendí del todo. ¿Me lo podés decir de otra forma?",
      toolCallsMade,
      iterations,
      hitCap:        false,
    }
  }

  return { reply: finalReply, toolCallsMade, iterations, hitCap: false }
}

// ── Input item type ─────────────────────────────────────────────
// Responses API accepts a few shapes interleaved. We declare the
// shapes we send so TS keeps us honest. The official SDK exposes
// the union as `ResponseInputItem`; we mirror only what we use.

type ResponsesInputItem =
  | { role: "user" | "assistant" | "developer"; content: string }
  | {
      type:      "function_call"
      call_id:   string
      name:      string
      arguments: string
    }
  | {
      type:    "function_call_output"
      call_id: string
      output:  string
    }
