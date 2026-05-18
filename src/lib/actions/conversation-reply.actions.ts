"use server"

import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth"
import { isAdminRole } from "@/lib/roles"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { stripWhatsAppPrefix } from "@/lib/phone"
import { sendWhatsAppMessage } from "@/lib/twilio/send"
import { appendConversationMessage } from "@/lib/conversations"

export interface ReplyResult {
  success: boolean
  error?:   string
  /** Provided on success so the client can clear the input + scroll. */
  messageId?: string
}

/**
 * Send a manual WhatsApp reply from the dashboard compose box.
 *
 * Semantics:
 *   • Authorization: admin OR the agent currently assigned to the lead.
 *   • Auto-mute: flips the conversation to `pending` so the bot stops
 *     replying. The human is in control until they hit "Reactivar bot".
 *   • 24h window guard: WhatsApp's customer-service window blocks
 *     free-form sends >24h after the lead's last inbound. We check
 *     here so we surface a clean error instead of letting Twilio
 *     reject the message with 63016. Template-based out-of-window
 *     sends are a follow-up once Meta approves a template.
 *   • Persistence: writes the outbound row BEFORE the Twilio send so
 *     a failure still leaves a visible "we tried to send this" trail
 *     in the dashboard. external_msg_id is null on failure; the
 *     dashboard can surface that as a retry affordance later.
 */
export async function sendManualReply(args: {
  conversationId: string
  body:           string
}): Promise<ReplyResult> {
  const body = args.body.trim()
  if (!body) return { success: false, error: "El mensaje está vacío." }
  if (body.length > 1500) {
    return { success: false, error: "El mensaje es demasiado largo (máx. 1500 caracteres)." }
  }

  const { profile } = await requireAuth()
  const supabase    = await createClient()

  // Pull the conversation + assigned-to via the user-scoped client so
  // RLS double-checks read access on top of our explicit role gate.
  const convRes = await supabase
    .from("conversations")
    .select("id, kind, external_id, status, lead:leads(assigned_to)")
    .eq("id", args.conversationId)
    .maybeSingle()
  if (convRes.error || !convRes.data) {
    return { success: false, error: "Conversación no encontrada." }
  }
  const conv = convRes.data as {
    id:          string
    kind:        string
    external_id: string | null
    status:      "open" | "pending" | "closed"
    lead:        { assigned_to: string | null } | null
  }
  if (!conv.external_id) {
    return { success: false, error: "Esta conversación no tiene un número de WhatsApp asociado." }
  }

  const isAdmin = isAdminRole(profile.role)
  if (!isAdmin && (conv.lead?.assigned_to ?? null) !== profile.id) {
    return { success: false, error: "No tenés permiso para responder en esta conversación." }
  }

  // ── 24h customer-service window check ────────────────────────────
  // WhatsApp Business policy: free-form messages only within 24h of
  // the lead's last inbound. Template messages bypass this — when
  // we wire those up the check becomes per-message-type.
  const lastInboundRes = await supabase
    .from("conversation_messages")
    .select("created_at")
    .eq("conversation_id", args.conversationId)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  const lastInboundAt = lastInboundRes.data?.created_at
    ? new Date(lastInboundRes.data.created_at).getTime()
    : null
  const within24h = lastInboundAt != null && (Date.now() - lastInboundAt) < 24 * 60 * 60 * 1000
  if (!within24h) {
    return {
      success: false,
      error:   "Fuera de la ventana de 24h de WhatsApp. Esperá a que el lead te escriba primero (o usá una plantilla aprobada, próximamente).",
    }
  }

  // ── Send via Twilio ─────────────────────────────────────────────
  const phoneE164 = stripWhatsAppPrefix(conv.external_id)
  const sendRes   = await sendWhatsAppMessage({ toE164: phoneE164, body })

  // Persist outbound regardless of send outcome so the dashboard
  // shows what we tried. external_msg_id reflects the Twilio sid
  // on success; null on failure.
  const persisted = await appendConversationMessage({
    conversationId: args.conversationId,
    direction:      "outbound",
    content:        body,
    externalMsgId:  sendRes.externalId ?? null,
  })

  // Auto-mute the bot on a manual reply so they don't double-ping
  // the lead on the next inbound. The admin can re-activate via the
  // existing "Reactivar bot" toggle.
  if (conv.status === "open") {
    const admin = createAdminClient()
    await admin
      .from("conversations")
      .update({ status: "pending" })
      .eq("id", args.conversationId)
  }

  revalidatePath("/conversations")
  revalidatePath(`/conversations/${args.conversationId}`)

  if (!sendRes.sent) {
    return {
      success: false,
      error:   sendRes.error ?? "No se pudo enviar el mensaje.",
    }
  }
  return {
    success:   true,
    messageId: persisted.saved ? persisted.messageId : undefined,
  }
}
