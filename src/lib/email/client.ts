import "server-only"
import { Resend } from "resend"

/**
 * Singleton Resend client. Reuses one instance per server runtime so we
 * don't re-parse the API key on every send. Throws at first use if the
 * env var is missing rather than at import time, so unrelated routes
 * still build even when Resend isn't configured locally.
 */
let client: Resend | null = null

export function getResend(): Resend {
  if (client) return client
  const key = process.env.RESEND_API_KEY
  if (!key) {
    throw new Error(
      "RESEND_API_KEY no está configurada. Definila en .env.local " +
      "y en Vercel (production/preview/development).",
    )
  }
  client = new Resend(key)
  return client
}

/** Verified sender, e.g. `"easyrent <no-reply@easyrent.house>"`. */
export function getEmailFrom(): string {
  const from = process.env.EMAIL_FROM
  if (!from) {
    throw new Error(
      "EMAIL_FROM no está configurada. Definila como " +
      '"<nombre> <correo@dominio.verificado>".',
    )
  }
  return from
}
