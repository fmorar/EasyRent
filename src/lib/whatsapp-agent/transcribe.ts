import "server-only"
import OpenAI, { toFile } from "openai"
import { fetchTwilioMedia } from "@/lib/twilio/media"

/**
 * Transcribe a WhatsApp voice note to text using OpenAI Whisper.
 *
 * Why this matters: in Costa Rica (and LatAm broadly) leads send
 * voice notes far more often than text. Without transcription the
 * agent has to ask the lead to "please write" — which kills the
 * conversation. With transcription the agent treats the audio as a
 * normal text turn and keeps the funnel moving.
 *
 * Flow:
 *   1. Download the audio from Twilio (auth-gated CDN).
 *   2. Reject anything > MAX_BYTES (Whisper's 25 MB hard limit).
 *   3. Wrap as a multipart upload with a filename hint so Whisper's
 *      demuxer picks the right decoder — WhatsApp sends `audio/ogg`
 *      (Opus inside Ogg) which Whisper supports natively.
 *   4. Force `language=es` — CR market is ~all-Spanish and Whisper
 *      occasionally mis-detects short audios as Portuguese or
 *      Italian. The agent's system prompt still handles bilingual
 *      replies if the lead actually spoke English.
 *
 * Returns a discriminated union so the caller can render specific
 * fallback strings (too-large vs noisy vs API error). We deliberately
 * do NOT throw — the webhook's 15 s timeout is tight and we'd rather
 * fall back to "please write" than 500 the Twilio request.
 */

// Whisper's documented hard cap. We check ahead of the upload to
// avoid wasting the multipart roundtrip on too-large clips.
const MAX_BYTES      = 25 * 1024 * 1024
// Anything shorter than this is almost certainly silence, a sticker
// previewing as audio, or Whisper hallucinating ".".
const MIN_TRANSCRIPT = 3

let openaiClient: OpenAI | null = null
function getClient(): OpenAI {
  if (openaiClient) return openaiClient
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY not set")
  openaiClient = new OpenAI({ apiKey })
  return openaiClient
}

export interface TranscribeOk {
  ok:         true
  text:       string
  byteLength: number
  durationMs: number
}

export interface TranscribeFail {
  ok:     false
  reason: "too_large" | "empty" | "error"
  error?: string
}

export type TranscribeResult = TranscribeOk | TranscribeFail

export async function transcribeWhatsAppAudio(mediaUrl: string): Promise<TranscribeResult> {
  const startedAt = Date.now()
  try {
    const { buffer, contentType, byteLength } = await fetchTwilioMedia(mediaUrl)
    if (byteLength > MAX_BYTES) {
      return { ok: false, reason: "too_large" }
    }

    const ext      = guessExt(contentType)
    const filename = `whatsapp-audio.${ext}`

    const client = getClient()
    const resp = await client.audio.transcriptions.create({
      file:        await toFile(buffer, filename, { type: contentType }),
      model:       "whisper-1",
      language:    "es",
      // Deterministic transcripts make manual debugging easier when
      // we re-run the same clip from the dashboard.
      temperature: 0,
    })

    const text = (resp.text ?? "").trim()
    if (text.length < MIN_TRANSCRIPT) {
      return { ok: false, reason: "empty" }
    }
    return {
      ok:         true,
      text,
      byteLength,
      durationMs: Date.now() - startedAt,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[whatsapp-agent.transcribe] failed", msg)
    return { ok: false, reason: "error", error: msg }
  }
}

/**
 * Map a content-type Twilio reports to a filename extension Whisper
 * understands. The extension is the strongest hint Whisper has when
 * the multipart upload doesn't include explicit container metadata
 * (some clips arrive without sniffable magic bytes).
 */
function guessExt(contentType: string): string {
  const ct = contentType.toLowerCase()
  if (ct.includes("ogg"))  return "ogg"
  if (ct.includes("opus")) return "ogg"
  if (ct.includes("mpeg")) return "mp3"
  if (ct.includes("mp3"))  return "mp3"
  if (ct.includes("mp4"))  return "mp4"
  if (ct.includes("m4a"))  return "m4a"
  if (ct.includes("aac"))  return "m4a"
  if (ct.includes("wav"))  return "wav"
  if (ct.includes("webm")) return "webm"
  if (ct.includes("flac")) return "flac"
  return "ogg"   // safest default for WhatsApp voice notes
}
