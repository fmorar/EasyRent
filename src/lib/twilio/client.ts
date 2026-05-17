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
 * When false, the webhook still persists messages but the agent
 * runner is skipped. Useful for: ramping the bot on a few accounts,
 * killing it fast during an incident, holding traffic during a
 * maintenance window.
 */
export function isAgentEnabled(): boolean {
  return process.env.WHATSAPP_AGENT_ENABLED === "true"
}
