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

    // Defensive cleanup before handing the body to Twilio:
    //   • Strip Markdown image embeds `![alt](url)` — WhatsApp doesn't
    //     render them and Twilio's gateway has rejected messages that
    //     mixed multiple URLs with this pattern. The agent prompt
    //     forbids them but the model sometimes ignores us.
    //   • Convert `**bold**` → `*bold*` so it actually renders bold
    //     on WhatsApp instead of showing the literal asterisks.
    //   • Trim to 1500 chars (Twilio's hard cap is 1600 — buffer for
    //     ellipsis + safety against multi-byte char miscounts).
    const cleaned = args.body
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")              // strip image embeds
      .replace(/\*\*([^*]+)\*\*/g, "*$1*")              // MD bold → WA bold
      .replace(/\n{3,}/g, "\n\n")                       // collapse runs of blank lines
      .trim()
    const body = cleaned.length > 1500
      ? cleaned.slice(0, 1497).trimEnd() + "…"
      : cleaned

    const message = await twilio.messages.create({
      from,
      to:   toTwilioWhatsAppAddr(args.toE164),
      body,
      ...(args.mediaUrl ? { mediaUrl: [args.mediaUrl] } : {}),
    })

    return { sent: true, externalId: message.sid }
  } catch (err) {
    // Surface the Twilio error code + status separately so it shows
    // in Vercel's log table (which only displays the LAST console
    // call per request — without an explicit terminal log line the
    // [twilio.send] error gets hidden behind the [whatsapp.agent]
    // success line emitted later in the request).
    type TwilioErrShape = { code?: number; status?: number; moreInfo?: string }
    const e = err as Error & TwilioErrShape
    console.error(
      `[twilio.send] FAILED code=${e.code ?? "?"} status=${e.status ?? "?"} msg=${e.message ?? String(err)} more=${e.moreInfo ?? "-"}`,
    )
    return { sent: false, error: e.message ?? String(err) }
  }
}
