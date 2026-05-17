import { NextResponse } from "next/server"
import { verifyTwilioSignature, publicUrlFromRequest } from "@/lib/twilio/verify"
import { sendWhatsAppMessage } from "@/lib/twilio/send"
import { isAgentEnabled } from "@/lib/twilio/client"
import { findOrCreateWhatsAppLead } from "@/lib/actions/whatsapp-lead.actions"
import {
  findOrCreateWhatsAppConversation,
  appendConversationMessage,
} from "@/lib/conversations"
import { toE164 } from "@/lib/phone"
import { runAgentTurn } from "@/lib/whatsapp-agent/run"
import { runOwnerAgentTurn } from "@/lib/whatsapp-agent/owner-run"
import { transcribeWhatsAppAudio } from "@/lib/whatsapp-agent/transcribe"
import { reEngageLead } from "@/lib/whatsapp-agent/lead-reengagement"

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
  const from              = params.From              ?? ""    // "whatsapp:+50688888888"
  const body              = (params.Body ?? "").trim()
  const messageSid        = params.MessageSid        ?? null  // unique across Twilio
  const numMedia          = parseInt(params.NumMedia ?? "0", 10) || 0
  const mediaUrl0         = params.MediaUrl0         ?? null
  const mediaContentType0 = params.MediaContentType0 ?? null

  if (!from || !messageSid) {
    console.warn("[whatsapp.inbound] missing From/MessageSid", { from: !!from, sid: !!messageSid })
    return new NextResponse("ok", { status: 200 })
  }

  const phoneE164 = toE164(from)
  if (!phoneE164) {
    console.warn("[whatsapp.inbound] unparseable From", from)
    return new NextResponse("ok", { status: 200 })
  }

  // ── 2b. Transcribe audio (if any) ───────────────────────────────
  // WhatsApp voice notes are wildly common in CR. We run Whisper
  // BEFORE persisting so the conversation row stores the transcript
  // as `content` — much more useful in the dashboard than "[media]",
  // and the agent loads context from the DB so it'll see the
  // transcript naturally on the next loop turn.
  //
  // We keep `mediaUrl` populated either way so the human-handoff
  // dashboard can still play the original audio for verification.
  //
  // Opt-out via WHATSAPP_AUDIO_TRANSCRIBE_DISABLED=true (matches the
  // agent kill-switch pattern). Without an OpenAI key we silently
  // skip — the static fallback below handles the lead gracefully.
  let effectiveBody    = body
  let audioFallback: string | null = null
  const isAudio        = !!mediaUrl0 && mediaContentType0?.toLowerCase().startsWith("audio/")
  const transcribeOn   =
    process.env.WHATSAPP_AUDIO_TRANSCRIBE_DISABLED !== "true" &&
    !!process.env.OPENAI_API_KEY
  if (isAudio && mediaUrl0 && transcribeOn) {
    const t = await transcribeWhatsAppAudio(mediaUrl0)
    if (t.ok) {
      // Preserve any text caption sent alongside the audio. Rare on
      // WhatsApp but possible from some clients.
      effectiveBody = body
        ? `${body}\n\n[transcripción de audio]: ${t.text}`
        : t.text
      console.log(
        `[whatsapp.audio] transcribed ${t.byteLength}B in ${t.durationMs}ms (${t.text.length} chars)`,
      )
    } else if (t.reason === "too_large") {
      console.warn("[whatsapp.audio] too_large — falling back")
      audioFallback = "Recibí tu audio pero es muy largo para procesarlo. ¿Me lo podés resumir por texto?"
    } else {
      console.warn(`[whatsapp.audio] ${t.reason} — falling back`, t.error ?? "")
      audioFallback = "Recibí tu audio pero no logré entenderlo bien. ¿Me lo podés escribir?"
    }
  }

  // ── 3. Resolve lead + conversation ──────────────────────────────
  let leadId: string
  let conversationId: string
  let conversationStatus: "open" | "closed" | "pending"
  let conversationKind: "lead" | "owner" = "lead"
  try {
    const lead = await findOrCreateWhatsAppLead({ fromRaw: from, firstMessage: effectiveBody })
    leadId = lead.leadId

    const conv = await findOrCreateWhatsAppConversation({
      leadId,
      phoneE164: lead.phoneE164,
    })
    conversationId     = conv.id
    conversationStatus = conv.status
    conversationKind   = conv.kind
  } catch (err) {
    // Persistence layer broke — we'd rather drop this message than
    // tell Twilio to retry forever. Logging it for triage; if this
    // fires repeatedly it's an outage we should page on.
    console.error("[whatsapp.inbound] lead/conversation resolution failed", err)
    return new NextResponse("ok", { status: 200 })
  }

  // ── 4. Persist inbound message (idempotent on MessageSid) ───────
  // `effectiveBody` is the transcribed text when the inbound was a
  // voice note (so the agent loads real Spanish text on next turn).
  // We still keep the original audio URL on `mediaUrl` for the human
  // dashboard to play back when verifying.
  const persisted = await appendConversationMessage({
    conversationId,
    direction:     "inbound",
    content:       effectiveBody || (numMedia > 0 ? "[media]" : ""),
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

  // Decide the reply:
  //   • Audio that failed to transcribe → audioFallback explains the
  //     specific failure mode.
  //   • Non-audio media with no caption (photo / video / sticker) →
  //     still unsupported in v1; ask them to write.
  //   • Otherwise the agent handles it (text body or transcribed audio).
  //
  // `null` means "intentional silence — don't send anything". The
  // agent uses that for low-information turns ("ok" / "dale") to
  // stop feeling robotic. Static-fallback strings are never null.
  let reply: string | null
  let triggerReEngagement: { propertyId: string; leadConversationId: string | null } | null = null
  if (audioFallback) {
    reply = audioFallback
  } else if (!effectiveBody && numMedia > 0) {
    reply = "Por ahora puedo leer texto y audios de voz. ¿Me lo podés escribir o mandar como nota de voz?"
  } else if (conversationKind === "owner") {
    // ── Owner-onboarding path ──────────────────────────────────
    // This thread was opened by our outbound outreach (cron). The
    // owner agent runs a different prompt + tool set focused on
    // capturing consent. When it accepts, autoClaimListing already
    // ran inside the tool — we just need to fire the lead
    // re-engagement here, because the lead's conversation lives in
    // a different row from this owner thread.
    try {
      const turn = await runOwnerAgentTurn(conversationId)
      reply = turn.reply
      console.log(
        `[whatsapp.owner] conv=${conversationId} iterations=${turn.iterations} tools=${turn.toolCallsMade}${turn.accepted ? " accepted" : turn.declined ? " declined" : ""}`,
      )
      // If the owner accepted, queue a re-engagement to the lead
      // AFTER we reply to the owner. We don't await it inside the
      // owner reply path to keep latency tight.
      if (turn.accepted) {
        triggerReEngagement = await resolveReEngagement(conversationId)
      }
    } catch (err) {
      console.error("[whatsapp.owner] turn failed", err)
      reply = "Gracias por escribir. Te respondemos en un momento."
    }
  } else if (isAgentEnabled()) {
    // ── Lead concierge path (existing) ──────────────────────────
    try {
      const turn = await runAgentTurn(conversationId)
      reply = turn.reply
      console.log(
        `[whatsapp.agent] conv=${conversationId} iterations=${turn.iterations} tools=${turn.toolCallsMade}${turn.hitCap ? " hit-cap" : ""}${turn.reply == null ? " silent" : ""}`,
      )
    } catch (err) {
      console.error("[whatsapp.agent] turn failed", err)
      reply = "Gracias por escribirnos. Te respondemos en un rato."
    }
  } else {
    // Agent disabled (kill switch on or no OpenAI key): generic
    // placeholder so the channel stays alive while we sort it out.
    reply = "¡Hola! Soy el asistente de easyrent. Ya recibí tu mensaje, en un momento te respondo con info de propiedades. 🏠"
  }

  // Silent turn — agent decided no reply adds value. Return 200 to
  // Twilio without sending. The inbound message is already persisted
  // so the dashboard reflects it.
  if (reply == null) {
    return new NextResponse("ok", { status: 200 })
  }

  // ── 6. Send + persist outbound ──────────────────────────────────
  const result = await sendWhatsAppMessage({ toE164: phoneE164, body: reply })

  await appendConversationMessage({
    conversationId,
    direction:     "outbound",
    content:       reply,
    externalMsgId: result.externalId ?? null,
  })

  // Final per-request log line. Vercel's runtime-logs table shows the
  // LAST console call per request — keeping this one terminal makes
  // send failures visible at a glance instead of being hidden behind
  // an earlier "agent succeeded" line.
  if (result.sent) {
    console.log(
      `[whatsapp.inbound] conv=${conversationId} sent sid=${result.externalId ?? "?"} chars=${reply.length}`,
    )
  } else {
    console.error(
      `[whatsapp.inbound] conv=${conversationId} send FAILED chars=${reply.length} err=${result.error ?? "unknown"}`,
    )
  }

  // ── 7. Lead re-engagement (post-owner-accept) ──────────────────
  // Fire-and-forget: if an owner accepted in this turn, message the
  // original lead with the just-published property. Doing it AFTER
  // we replied to the owner keeps Twilio's webhook turnaround tight.
  if (triggerReEngagement) {
    reEngageLead(triggerReEngagement).catch((err) => {
      console.error("[whatsapp.reengage] failed", err)
    })
  }

  return new NextResponse("ok", { status: 200 })
}

/**
 * Look up the lead's original conversation + the property we just
 * published, so the re-engagement helper has what it needs to write
 * the "great news, found one for you" message.
 *
 * Called from the owner reply path AFTER autoClaimListing has run.
 */
async function resolveReEngagement(
  ownerConversationId: string,
): Promise<{ propertyId: string; leadConversationId: string | null } | null> {
  // The owner_outreach_attempts row was just updated to status=accepted
  // with claimed_property_id set. Pull it to find the search_request,
  // then resolve the lead's own conversation.
  const { createAdminClient } = await import("@/lib/supabase/admin")
  const admin = createAdminClient()
  const att = await admin
    .from("owner_outreach_attempts")
    .select("claimed_property_id, search_request_id")
    .eq("conversation_id", ownerConversationId)
    .eq("status", "accepted")
    .maybeSingle()
  if (!att.data?.claimed_property_id) return null

  const search = await admin
    .from("search_requests")
    .select("conversation_id")
    .eq("id", att.data.search_request_id)
    .maybeSingle()

  return {
    propertyId:         att.data.claimed_property_id,
    leadConversationId: search.data?.conversation_id ?? null,
  }
}

/**
 * Twilio sends OPTIONS preflight for some Console UI integrations.
 * Acknowledge with 200 so the Console "Test Webhook" button doesn't
 * show a red error before the first real POST.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: { Allow: "POST, OPTIONS" } })
}
