import "server-only"
import { getTwilio, getTwilioWhatsAppFrom } from "./client"
import { toTwilioWhatsAppAddr } from "@/lib/phone"

interface SendArgs {
  /** Recipient phone in E.164 (`+50688888888`). Caller normalizes. */
  toE164:   string
  /** Plain-text body. Twilio supports basic WhatsApp markdown
   *  (*bold*, _italic_) but we keep it simple. Hard cap: 1600 chars. */
  body:     string
  /** Optional media URL — Twilio fetches and attaches. v1 doesn't
   *  use it; reserved for follow-up phases (property photos, docs). */
  mediaUrl?: string
}

interface SendResult {
  sent:        boolean
  /** Twilio's `MessageSid` — we store it on the persisted outbound
   *  row so status callbacks can match back to the message. */
  externalId?: string
  error?:      string
}

/**
 * Send a WhatsApp message via Twilio's REST API.
 *
 * Why REST instead of TwiML response: a TwiML-sync reply locks the
 * webhook response into one outbound message and forces us to fit
 * everything into the webhook's lifetime. The REST path is async,
 * supports multiple sends per turn, and lets us send AFTER the
 * agent finishes its tool-calling loop — which can take 3-8 s.
 *
 * Never throws — returns a structured result. Callers should always
 * persist the outbound row first (with the body) and then call this;
 * if `sent=false` we surface the error to the dashboard / Sentry
 * without breaking the conversation flow.
 */
export async function sendWhatsAppMessage(args: SendArgs): Promise<SendResult> {
  try {
    const twilio = getTwilio()
    const from   = getTwilioWhatsAppFrom()

    // Twilio truncates at 1600; we trim defensively so the user sees
    // a clean ellipsis rather than mid-word cut.
    const body = args.body.length > 1500
      ? args.body.slice(0, 1497).trimEnd() + "…"
      : args.body

    const message = await twilio.messages.create({
      from,
      to:   toTwilioWhatsAppAddr(args.toE164),
      body,
      ...(args.mediaUrl ? { mediaUrl: [args.mediaUrl] } : {}),
    })

    return { sent: true, externalId: message.sid }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[twilio.send] failed", msg)
    return { sent: false, error: msg }
  }
}
