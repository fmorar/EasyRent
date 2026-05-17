import "server-only"
import Twilio from "twilio"

/**
 * Singleton Twilio REST client. Reuses one instance per server
 * runtime so we don't pay the credential-parse cost on every send.
 * Throws at first use — never at import time — so routes that don't
 * touch Twilio still build cleanly even without Twilio env vars set
 * locally.
 *
 * Why a singleton: each `new Twilio()` opens a new HTTPS keep-alive
 * pool and re-reads the auth token. With a singleton we share the
 * pool across concurrent webhooks → fewer reconnects, faster sends.
 */
let cached: Twilio.Twilio | null = null

export function getTwilio(): Twilio.Twilio {
  if (cached) return cached
  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) {
    throw new Error(
      "Twilio not configured: set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN. " +
      "(Local dev: .env.local. Vercel: Settings → Environment Variables.)",
    )
  }
  cached = Twilio(sid, token)
  return cached
}

/**
 * Returns the verified sender address Twilio expects for outbound
 * WhatsApp messages — `whatsapp:+14155238886` for the sandbox or a
 * production-approved number.
 *
 * We keep this as a function (not a const) so missing env doesn't
 * crash the route bundle at import time — only callers that actually
 * send hit the error.
 */
export function getTwilioWhatsAppFrom(): string {
  const from = process.env.TWILIO_WHATSAPP_FROM
  if (!from) {
    throw new Error(
      "Twilio WhatsApp sender not configured: set TWILIO_WHATSAPP_FROM " +
      "(format: 'whatsapp:+14155238886' for the sandbox or your approved number).",
    )
  }
  return from
}

/**
 * Feature flag — whether the inbound AI agent is allowed to reply.
 *
 * Inverted gate: default is ON, opt-out via WHATSAPP_AGENT_DISABLED=true.
 * Rationale:
 *   • Production behavior should default to "agent on" once the route
 *     and OpenAI key are in place — otherwise leads get a static
 *     placeholder every time we forget to flip a flag after deploy.
 *   • Vercel's `vercel env add` is fiddly with empty-string values for
 *     plain-text flags, and an opt-IN flag silently broke once already.
 *     Opt-OUT is the safer default (worst case: agent runs).
 *   • Kill switch is still one env var away: set
 *     WHATSAPP_AGENT_DISABLED=true to mute the bot during an incident
 *     without redeploying.
 *
 * We also require OPENAI_API_KEY at runtime — if it's missing, the
 * runner throws and the webhook falls back to a graceful message,
 * so the flag isn't load-bearing for safety.
 */
export function isAgentEnabled(): boolean {
  if (process.env.WHATSAPP_AGENT_DISABLED === "true") return false
  // Defensive: don't try to call OpenAI without a key — let the
  // static placeholder reply instead.
  if (!process.env.OPENAI_API_KEY) return false
  return true
}
