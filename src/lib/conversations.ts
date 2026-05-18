import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { maybeAdvanceLeadStage } from "@/lib/leads/stage-machine"
import type { Database } from "@/types/supabase"

type Direction = Database["public"]["Enums"]["message_direction"]

/**
 * Find an existing WhatsApp conversation for a phone, or create a new
 * one bound to the given lead.
 *
 * Uses the partial unique index `conversations_external_id_channel_idx`
 * to guarantee that two concurrent inbound webhooks for the same
 * number can't accidentally split the thread into two rows — the
 * second concurrent INSERT loses the race, we fall back to SELECT.
 *
 * Returns the conversation id + whether we created it (some callers
 * want to fire a "new conversation" event the first time).
 */
export async function findOrCreateWhatsAppConversation(args: {
  leadId:     string
  phoneE164:  string
}): Promise<{
  id:      string
  created: boolean
  status:  Database["public"]["Enums"]["conversation_status"]
  /** "lead" = lead concierge agent. "owner" = owner captation agent. */
  kind:    "lead" | "owner"
}> {
  const admin = createAdminClient()

  const existing = await admin
    .from("conversations")
    .select("id, status, kind")
    .eq("channel", "whatsapp")
    .eq("external_id", args.phoneE164)
    .maybeSingle()

  if (existing.data) {
    return {
      id:      existing.data.id,
      created: false,
      status:  existing.data.status,
      kind:    (existing.data.kind ?? "lead") as "lead" | "owner",
    }
  }

  const inserted = await admin
    .from("conversations")
    .insert({
      lead_id:         args.leadId,
      channel:         "whatsapp",
      external_id:     args.phoneE164,
      status:          "open",
      last_message_at: new Date().toISOString(),
    })
    .select("id, status, kind")
    .single()

  if (inserted.data) {
    return {
      id:      inserted.data.id,
      created: true,
      status:  inserted.data.status,
      kind:    (inserted.data.kind ?? "lead") as "lead" | "owner",
    }
  }

  if (inserted.error?.code === "23505") {
    const retry = await admin
      .from("conversations")
      .select("id, status, kind")
      .eq("channel", "whatsapp")
      .eq("external_id", args.phoneE164)
      .single()
    if (retry.data) {
      return {
        id:      retry.data.id,
        created: false,
        status:  retry.data.status,
        kind:    (retry.data.kind ?? "lead") as "lead" | "owner",
      }
    }
  }

  throw new Error(
    `findOrCreateWhatsAppConversation failed: ${inserted.error?.message ?? "unknown"}`,
  )
}

interface AppendArgs {
  conversationId: string
  direction:      Direction
  content:        string
  mediaUrl?:      string | null
  /** Twilio MessageSid. Globally unique across all of Twilio. */
  externalMsgId?: string | null
}

/**
 * Persist a single message + bump the conversation's `last_message_at`.
 *
 * Idempotency: we rely on Twilio's MessageSid being globally unique.
 * If the same sid lands twice (Twilio retried because we 5xx'd),
 * the unique constraint on external_msg_id (we add it below if it's
 * missing) means the second INSERT is a no-op. We treat the unique-
 * violation error as "already saved" and return.
 *
 * `last_message_at` is touched on both directions so the dashboard's
 * "recent threads" list stays accurate.
 */
export async function appendConversationMessage(args: AppendArgs): Promise<
  { saved: true; messageId: string } | { saved: false; reason: "duplicate" | "error"; error?: string }
> {
  const admin = createAdminClient()

  const insert = await admin
    .from("conversation_messages")
    .insert({
      conversation_id: args.conversationId,
      direction:       args.direction,
      content:         args.content,
      media_url:       args.mediaUrl     ?? null,
      external_msg_id: args.externalMsgId ?? null,
    })
    .select("id")
    .single()

  if (insert.error) {
    if (insert.error.code === "23505") {
      // Idempotent: same MessageSid already saved.
      return { saved: false, reason: "duplicate" }
    }
    return { saved: false, reason: "error", error: insert.error.message }
  }

  // Bump the parent. We don't need the result; if it fails we still
  // got the message persisted.
  await admin
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", args.conversationId)

  // Funnel auto-advance: any outbound from us proves we're engaged.
  // The first time it fires moves the lead to `contacted`; later
  // outbounds are no-ops because maybeAdvanceLeadStage is monotonic.
  // We only do this for LEAD conversations — outbound to an owner
  // (kind='owner') shouldn't touch their own lead's stage.
  if (args.direction === "outbound") {
    const conv = await admin
      .from("conversations")
      .select("lead_id, kind")
      .eq("id", args.conversationId)
      .single()
    if (conv.data?.lead_id && (conv.data.kind ?? "lead") === "lead") {
      await maybeAdvanceLeadStage({
        leadId:    conv.data.lead_id,
        suggested: "contacted",
        reason:    "first-bot-reply",
      })
    }
  }

  return { saved: true, messageId: insert.data.id }
}
