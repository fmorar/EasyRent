import "server-only"
import OpenAI from "openai"
import { z } from "zod"
import type { Tool } from "openai/resources/responses/responses"
import { createAdminClient } from "@/lib/supabase/admin"
import { OWNER_PROMPT } from "./owner-prompt"
import { autoClaimListing } from "./auto-claim"
import type { Database } from "@/types/supabase"

type ConvMessage = Database["public"]["Tables"]["conversation_messages"]["Row"]
type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Owner-onboarding agent runner. Mirrors the lead concierge runner
 * shape (single message → reply) but with:
 *   • A different system prompt (OWNER_PROMPT).
 *   • A tiny tool set focused on a binary outcome (accept / decline /
 *     ask question).
 *   • A different context loader — we care about the search_request
 *     and the external_listing this attempt belongs to, NOT the
 *     lead's profile.
 *
 * Lifecycle the runner enforces:
 *   • accept_listing  → autoClaimListing() → status becomes 'accepted',
 *                       a real property gets published, the search
 *                       gets marked fulfilled.
 *   • decline_listing → outreach status becomes 'declined'.
 *   • request_more_info → just persisted as a note, no state change.
 *
 * Re-uses the same conversation_messages table the lead path uses;
 * conversation.kind='owner' is the disambiguator.
 */

const MAX_ITERATIONS    = 4
const MODEL             = "gpt-4o-mini"
const RECENT_MSGS_LIMIT = 12

let openaiClient: OpenAI | null = null
function getClient(): OpenAI {
  if (openaiClient) return openaiClient
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY not set")
  openaiClient = new OpenAI({ apiKey })
  return openaiClient
}

export interface OwnerTurnResult {
  reply:         string
  toolCallsMade: number
  iterations:    number
  /** True when the owner accepted and we auto-published the listing. */
  accepted:      boolean
  /** True when the owner declined. */
  declined:      boolean
}

export async function runOwnerAgentTurn(conversationId: string): Promise<OwnerTurnResult> {
  const admin   = createAdminClient()
  const client  = getClient()

  // ── Load the owner-conversation context ──────────────────────────
  const ctx = await loadOwnerContext(admin, conversationId)
  if (!ctx) {
    return {
      reply:         "Gracias por escribir, te respondemos en un momento.",
      toolCallsMade: 0,
      iterations:    0,
      accepted:      false,
      declined:      false,
    }
  }

  const instructions = `${OWNER_PROMPT}\n\n${renderContext(ctx)}`

  // Build initial input from recent messages.
  const input: ResponsesInputItem[] = ctx.messages
    .filter((m) => m.content && m.content.trim().length > 0)
    .map((m) => ({
      role:    m.direction === "inbound" ? "user" : "assistant",
      content: m.content,
    }))

  let toolCallsMade = 0
  let iterations    = 0
  let finalReply: string | null = null
  let accepted = false
  let declined = false

  while (iterations < MAX_ITERATIONS) {
    iterations += 1
    const response = await client.responses.create({
      model:             MODEL,
      instructions,
      input,
      tools:             OWNER_TOOL_DEFINITIONS as unknown as Tool[],
      tool_choice:       "auto",
      max_output_tokens: 400,
    })

    const toolCalls: Array<{ id: string; name: string; args: unknown }> = []
    let textBuf = ""
    for (const item of response.output ?? []) {
      if (item.type === "function_call") {
        let parsed: unknown
        try { parsed = JSON.parse(item.arguments ?? "{}") } catch { parsed = {} }
        toolCalls.push({ id: item.call_id, name: item.name, args: parsed })
      } else if (item.type === "message") {
        for (const part of item.content ?? []) {
          if (part.type === "output_text") textBuf += part.text
        }
      }
    }

    if (toolCalls.length === 0) {
      finalReply = textBuf.trim()
      break
    }

    for (const call of toolCalls) {
      toolCallsMade += 1
      const result = await executeOwnerTool(call.name, call.args, ctx)
      if (result.terminal === "accepted") accepted = true
      if (result.terminal === "declined") declined = true

      input.push({
        type:      "function_call",
        call_id:   call.id,
        name:      call.name,
        arguments: JSON.stringify(call.args),
      })
      input.push({
        type:    "function_call_output",
        call_id: call.id,
        output:  JSON.stringify(result.payload),
      })
    }
  }

  if (finalReply == null) {
    finalReply = accepted
      ? "Listo, ya queda publicada con nosotros. Te aviso si el cliente coordina una visita."
      : declined
      ? "Sin problema. Gracias por tu tiempo — quedo por acá si en otro momento te interesa."
      : "Te respondo en un momento."
  }

  return { reply: finalReply || "Gracias por escribirnos.", toolCallsMade, iterations, accepted, declined }
}

// ── Context ──────────────────────────────────────────────────────────

interface OwnerContext {
  conversationId:     string
  attempt: Database["public"]["Tables"]["owner_outreach_attempts"]["Row"]
  externalListing: Database["public"]["Tables"]["external_listings"]["Row"]
  messages: ConvMessage[]
}

async function loadOwnerContext(
  admin:          AdminClient,
  conversationId: string,
): Promise<OwnerContext | null> {
  const att = await admin
    .from("owner_outreach_attempts")
    .select("*")
    .eq("conversation_id", conversationId)
    .maybeSingle()
  if (att.error || !att.data) return null

  const ext = await admin
    .from("external_listings")
    .select("*")
    .eq("id", att.data.external_listing_id)
    .maybeSingle()
  if (ext.error || !ext.data) return null

  const msgs = await admin
    .from("conversation_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(RECENT_MSGS_LIMIT)
  const messages = ((msgs.data ?? []) as ConvMessage[]).reverse()

  return {
    conversationId,
    attempt:          att.data,
    externalListing:  ext.data,
    messages,
  }
}

function renderContext(ctx: OwnerContext): string {
  const ext = ctx.externalListing
  const att = ctx.attempt
  const lines = [
    "## Contexto de esta conversación",
    `- Anuncio que les pitcheamos: ${ext.title}`,
    ext.location_text     ? `- Zona: ${ext.location_text}` : null,
    ext.price != null     ? `- Precio publicado: ${ext.currency === "CRC" ? "₡" : "$"}${Number(ext.price).toLocaleString("es-CR")}` : null,
    ext.listing_type      ? `- Operación: ${ext.listing_type === "rent" ? "alquiler" : "venta"}` : null,
    `- Link de origen: ${ext.source_url}`,
    "",
    "## Estado del intento",
    `- Confianza dueño: ${att.target_confidence != null ? Math.round(Number(att.target_confidence) * 100) + "%" : "(desconocida)"}`,
    `- Enviado: ${att.sent_at ?? "todavía no"}`,
    `- Primera respuesta: ${att.first_response_at ?? "(esta puede ser la primera)"}`,
  ].filter((l): l is string => !!l)
  return lines.join("\n")
}

// ── Tools ────────────────────────────────────────────────────────────

const AcceptListingSchema = z.object({
  notes: z.string().max(500).optional()
    .describe("Cualquier nota corta sobre la conversación (opcional, ej. 'quiere fotos profesionales')"),
})

const DeclineListingSchema = z.object({
  reason: z.enum(["not_interested", "already_closed", "no_agents", "wrong_number", "other"])
    .describe("Motivo más cercano a lo que dijo el dueño."),
  notes:  z.string().max(500).optional(),
})

const RequestMoreInfoSchema = z.object({
  question: z.string().min(2).max(300)
    .describe("La pregunta exacta del dueño, parafraseada brevemente."),
})

const OWNER_TOOL_DEFINITIONS = [
  {
    type:        "function",
    name:        "accept_listing",
    description: "Llamala cuando el dueño dio el OK explícito para que publiquemos su propiedad. Esto crea la property real, la marca como visible en el marketplace, y cierra el search_request del lead original.",
    parameters:  zodToJsonSchema(AcceptListingSchema),
  },
  {
    type:        "function",
    name:        "decline_listing",
    description: "Llamala cuando el dueño dijo que NO le interesa, ya cerró, o no trabaja con agentes. Marca el intento como declined y cierra la conversación.",
    parameters:  zodToJsonSchema(DeclineListingSchema),
  },
  {
    type:        "function",
    name:        "request_more_info",
    description: "Llamala cuando el dueño hace una pregunta razonable que necesita respuesta antes de aceptar/declinar. Solo registra la pregunta — vos respondela después.",
    parameters:  zodToJsonSchema(RequestMoreInfoSchema),
  },
] as const

type ToolResult = {
  payload:   Record<string, unknown>
  terminal?: "accepted" | "declined"
}

async function executeOwnerTool(
  name:    string,
  rawArgs: unknown,
  ctx:     OwnerContext,
): Promise<ToolResult> {
  try {
    switch (name) {
      case "accept_listing": {
        const args = AcceptListingSchema.parse(rawArgs)
        const result = await autoClaimListing({
          externalListingId: ctx.externalListing.id,
          searchRequestId:   ctx.attempt.search_request_id,
          outreachAttemptId: ctx.attempt.id,
        })
        if (!result) {
          return {
            payload: { ok: false, error: "No pudimos publicar — datos insuficientes. Quedó marcado para revisión manual." },
          }
        }
        return {
          payload: {
            ok:         true,
            published:  true,
            propertyId: result.propertyId,
            notes:      args.notes ?? null,
          },
          terminal: "accepted",
        }
      }
      case "decline_listing": {
        const args = DeclineListingSchema.parse(rawArgs)
        const admin = createAdminClient()
        await admin
          .from("owner_outreach_attempts")
          .update({
            status:      "declined",
            declined_at: new Date().toISOString(),
            last_error:  args.notes ?? null,
          })
          .eq("id", ctx.attempt.id)
        return {
          payload: { ok: true, reason: args.reason, notes: args.notes ?? null },
          terminal: "declined",
        }
      }
      case "request_more_info": {
        const args = RequestMoreInfoSchema.parse(rawArgs)
        // No DB change — we just want the model to record the question
        // so a future pass can see we've already addressed it.
        return { payload: { ok: true, recorded_question: args.question } }
      }
      default:
        return { payload: { ok: false, error: `unknown tool ${name}` } }
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        payload: {
          ok:    false,
          error: `Argument validation failed: ${err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
        },
      }
    }
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[owner-run] tool ${name} failed`, msg)
    return { payload: { ok: false, error: msg } }
  }
}

// ── Input item type / zod helper ─────────────────────────────────────

type ResponsesInputItem =
  | { role: "user" | "assistant" | "developer"; content: string }
  | { type: "function_call"; call_id: string; name: string; arguments: string }
  | { type: "function_call_output"; call_id: string; output: string }

function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const raw = z.toJSONSchema(schema, { target: "openapi-3.0" }) as Record<string, unknown>
  delete raw["$schema"]
  return raw
}
