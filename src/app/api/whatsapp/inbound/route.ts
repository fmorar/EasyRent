import { NextResponse } from "next/server"
import { verifyTwilioSignature, publicUrlFromRequest } from "@/lib/twilio/verify"
import { sendWhatsAppMessage } from "@/lib/twilio/send"
import { findOrCreateWhatsAppLead } from "@/lib/actions/whatsapp-lead.actions"
import {
  findOrCreateWhatsAppConversation,
  appendConversationMessage,
} from "@/lib/conversations"
import { toE164 } from "@/lib/phone"

/**
 * Twilio WhatsApp inbound webhook.
 *
 *   Twilio → POST /api/whatsapp/inbound  (form-urlencoded)
 *
 * We:
 *   1. Validate the X-Twilio-Signature so random internet POSTs
 *      can't write to our DB.
 *   2. Resolve / create the lead + conversation by canonical phone.
 *   3. Persist the inbound message — idempotent on Twilio MessageSid
 *      so retried webhooks don't duplicate.
 *   4. (MVP scope) reply with a static acknowledgement. The full AI
 *      agent runner ships in Phase 4; this route is the plumbing
 *      it'll plug into.
 *
 * Always returns 200 once we've persisted — including for
 * idempotent duplicates and for handoff-mode threads. Returning 5xx
 * causes Twilio to retry, which would just write more duplicates if
 * the underlying problem isn't transient.
 *
 * Returns 403 only when signature validation fails outright — Twilio
 * does NOT retry on auth failures, which is what we want.
 *
 * Node runtime (not Edge): we call out to Supabase + Twilio REST
 * inside a single request lifecycle. Future agent loop can run
 * 3-8 s easily.
 */
export const runtime = "nodejs"

export async function POST(request: Request): Promise<Response> {
  // ── 1. Read + verify signature ──────────────────────────────────
  // Twilio sends form-urlencoded. We read the body as text first
  // (so we can re-feed it to URLSearchParams) and convert to the
  // params object the validator expects.
  const rawBody  = await request.text()
  const params   = Object.fromEntries(new URLSearchParams(rawBody).entries())
  const url      = publicUrlFromRequest(request)
  const sigOk    = verifyTwilioSignature({
    signature: request.headers.get("x-twilio-signature"),
    url,
    params,
  })

  // In dev / local testing without a Twilio token, you can set
  // TWILIO_SKIP_SIGNATURE=true to bypass — never enable in prod.
  const skipSig = process.env.TWILIO_SKIP_SIGNATURE === "true"
  if (!sigOk && !skipSig) {
    console.warn("[whatsapp.inbound] signature rejected for", url)
    return new NextResponse("forbidden", { status: 403 })
  }

  // ── 2. Pull the bits we care about ──────────────────────────────
  const from        = params.From         ?? ""    // "whatsapp:+50688888888"
  const body        = (params.Body ?? "").trim()
  const messageSid  = params.MessageSid   ?? null  // unique across Twilio
  const numMedia    = parseInt(params.NumMedia ?? "0", 10) || 0
  const mediaUrl0   = params.MediaUrl0    ?? null

  if (!from || !messageSid) {
    console.warn("[whatsapp.inbound] missing From/MessageSid", { from: !!from, sid: !!messageSid })
    return new NextResponse("ok", { status: 200 })
  }

  const phoneE164 = toE164(from)
  if (!phoneE164) {
    console.warn("[whatsapp.inbound] unparseable From", from)
    return new NextResponse("ok", { status: 200 })
  }

  // ── 3. Resolve lead + conversation ──────────────────────────────
  let leadId: string
  let conversationId: string
  let conversationStatus: "open" | "closed" | "pending"
  try {
    const lead = await findOrCreateWhatsAppLead({ fromRaw: from, firstMessage: body })
    leadId = lead.leadId

    const conv = await findOrCreateWhatsAppConversation({
      leadId,
      phoneE164: lead.phoneE164,
    })
    conversationId     = conv.id
    conversationStatus = conv.status
  } catch (err) {
    // Persistence layer broke — we'd rather drop this message than
    // tell Twilio to retry forever. Logging it for triage; if this
    // fires repeatedly it's an outage we should page on.
    console.error("[whatsapp.inbound] lead/conversation resolution failed", err)
    return new NextResponse("ok", { status: 200 })
  }

  // ── 4. Persist inbound message (idempotent on MessageSid) ───────
  const persisted = await appendConversationMessage({
    conversationId,
    direction:     "inbound",
    content:       body || (numMedia > 0 ? "[media]" : ""),
    mediaUrl:      mediaUrl0,
    externalMsgId: messageSid,
  })

  // Duplicate webhook (Twilio retry after our 5xx earlier) — already
  // saved. Skip the rest, don't double-reply.
  if (!persisted.saved && persisted.reason === "duplicate") {
    return new NextResponse("ok", { status: 200 })
  }

  // ── 5. Decide whether to reply ──────────────────────────────────
  // If the conversation is in 'pending' (= handoff to human) or
  // 'closed', the bot shouldn't talk. Persisted message will surface
  // in the agent dashboard for human follow-up.
  if (conversationStatus !== "open") {
    return new NextResponse("ok", { status: 200 })
  }

  // Media-only inbound: v1 doesn't understand pictures or audio.
  // Surface a friendly note so the visitor doesn't think we ignored
  // them.
  let reply: string
  if (!body && numMedia > 0) {
    reply = "Por ahora puedo leer mensajes de texto. ¿Me lo podés escribir?"
  } else {
    // MVP placeholder reply. Phase 4 swaps this for the agent runner.
    reply = "¡Hola! Soy el asistente de easyrent. Ya recibí tu mensaje, en un momento te respondo con info de propiedades. 🏠"
  }

  // ── 6. Send + persist outbound ──────────────────────────────────
  const result = await sendWhatsAppMessage({ toE164: phoneE164, body: reply })

  await appendConversationMessage({
    conversationId,
    direction:     "outbound",
    content:       reply,
    externalMsgId: result.externalId ?? null,
  })

  return new NextResponse("ok", { status: 200 })
}

/**
 * Twilio sends OPTIONS preflight for some Console UI integrations.
 * Acknowledge with 200 so the Console "Test Webhook" button doesn't
 * show a red error before the first real POST.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: { Allow: "POST, OPTIONS" } })
}
