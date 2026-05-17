import "server-only"

/**
 * Download a media attachment from Twilio's CDN.
 *
 * Twilio gates `MediaUrl{n}` with Basic Auth using the same SID +
 * token the REST client uses for sending — even though the URL itself
 * looks public. A bare fetch against it returns 401.
 *
 * Twilio's CDN actually 307-redirects to a presigned S3 URL; `fetch`
 * follows that by default, and S3 ignores the stray Authorization
 * header on the second hop, so a single `fetch` with the Basic header
 * works end-to-end.
 *
 * Returns the bytes as a Node Buffer (Whisper's `toFile` helper
 * accepts that directly) plus the content-type from the response
 * headers — more reliable than the `MediaContentType{n}` webhook
 * param because Twilio sometimes normalizes formats on storage.
 *
 * Why a separate file (not inline in transcribe.ts):
 *   • The same helper will be reused for image vision + PDF
 *     extraction when those phases ship.
 *   • Keeps the Twilio auth concern out of the agent layer.
 */
export interface TwilioMediaResult {
  buffer:      Buffer
  contentType: string
  byteLength:  number
}

export async function fetchTwilioMedia(url: string): Promise<TwilioMediaResult> {
  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) {
    throw new Error(
      "fetchTwilioMedia: TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN not set",
    )
  }
  const auth = Buffer.from(`${sid}:${token}`).toString("base64")

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
    // 10s is generous — Twilio's CDN is fast and the largest WhatsApp
    // voice note we'll see is ~16 MB / a few seconds to download.
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    throw new Error(
      `fetchTwilioMedia: ${res.status} ${res.statusText} for ${url}`,
    )
  }
  const ab = await res.arrayBuffer()
  return {
    buffer:      Buffer.from(ab),
    contentType: res.headers.get("content-type") ?? "application/octet-stream",
    byteLength:  ab.byteLength,
  }
}
