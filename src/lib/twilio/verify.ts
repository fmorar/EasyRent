import "server-only"
import Twilio from "twilio"

/**
 * Twilio signs every webhook with HMAC-SHA1 in the `X-Twilio-Signature`
 * header. We validate it before doing anything else — without this,
 * anyone on the internet could POST to our inbound route and write
 * to `conversations` / `conversation_messages`.
 *
 * Twilio's official validator (`Twilio.validateRequest`) takes:
 *   • the auth token
 *   • the signature header
 *   • the FULL public URL Twilio called (must match what Twilio sees
 *     — proxies / Vercel forwarders can mangle this; we reconstruct
 *     deliberately)
 *   • the request body parsed as a plain object of strings
 *
 * If the host header is overridden by an attacker the signature
 * comparison fails because Twilio computed it against the public
 * URL it actually called.
 *
 * Two ways the URL is wrong in production:
 *
 *   1. Vercel rewrites `x-forwarded-proto: https` so the connection
 *      arrives as http internally — we must rebuild as https.
 *   2. Twilio attaches query params to the signed URL; if our public
 *      route had any, they must be included in the verification URL.
 */

interface VerifyArgs {
  /** Header value: `request.headers.get("x-twilio-signature")`. */
  signature: string | null
  /** Public URL Twilio called (https://…/api/whatsapp/inbound). */
  url:       string
  /** Form-urlencoded body parsed to a flat object. */
  params:    Record<string, string>
}

export function verifyTwilioSignature({ signature, url, params }: VerifyArgs): boolean {
  if (!signature) return false
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!token) {
    // Without a token we can't validate. Fail closed.
    console.error("[twilio.verify] TWILIO_AUTH_TOKEN missing — rejecting webhook")
    return false
  }
  try {
    return Twilio.validateRequest(token, signature, url, params)
  } catch (err) {
    console.error("[twilio.verify] validateRequest threw", err)
    return false
  }
}

/**
 * Rebuild the public URL Twilio invoked from a Next.js Request.
 *
 * Why we don't just trust `request.url`: behind Vercel the `host` and
 * `proto` headers may differ from what the public domain actually
 * serves. The forwarded-proto/host pair tells us what Twilio
 * connected to externally — that's what Twilio used to compute the
 * signature.
 */
export function publicUrlFromRequest(request: Request): string {
  const url   = new URL(request.url)
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")
  const host  = request.headers.get("x-forwarded-host")  ?? request.headers.get("host") ?? url.host
  // Twilio includes query params in the signed URL, so we preserve them.
  return `${proto}://${host}${url.pathname}${url.search}`
}
