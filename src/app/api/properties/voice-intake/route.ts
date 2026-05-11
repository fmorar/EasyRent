// ============================================================
// POST /api/properties/voice-intake
//
// Voice-dictation intake for the "new property" form. The flow:
//
//   1. Browser records audio with MediaRecorder, uploads as multipart
//      blob to this endpoint.
//   2. We run OpenAI Whisper (gpt-4o-mini-transcribe) on the audio
//      to get a clean Spanish (CR) transcript.
//   3. We hand the transcript to GPT-4o-mini with a JSON-mode response
//      and a tight system prompt to extract canonical form fields.
//   4. We validate the extracted JSON with Zod and return both the
//      raw transcript (for display) and the parsed field set.
//
// The form then calls `setValue()` on each non-null parsed field, so
// the agent only edits what wasn't captured cleanly.
//
// Runtime: Node (we use OpenAI SDK + file upload buffers).
// Auth: requires an authenticated session.
// ============================================================

import { NextResponse } from "next/server"
import OpenAI from "openai"
import { z } from "zod"
import { toFile } from "openai/uploads"
import { requireAuth } from "@/lib/auth"

export const runtime     = "nodejs"
export const maxDuration = 60

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── Parsed-field schema (mirrors propertySchema in property-form.tsx) ──
// All optional / nullable: the model only fills what's clearly in the
// transcript. We keep enums tight so the form can apply them straight
// to <Select> values.
const ParsedSchema = z.object({
  title:          z.string().nullable().optional(),
  description:    z.string().nullable().optional(),
  property_type:  z.enum(["apartment", "house", "land", "commercial", "office", "warehouse"]).nullable().optional(),
  listing_type:   z.enum(["sale", "rent"]).nullable().optional(),
  status:         z.enum(["available", "reserved", "sold", "off_market"]).nullable().optional(),
  is_furnished:   z.boolean().nullable().optional(),
  location_mode:  z.enum(["exact", "approximate"]).nullable().optional(),
  public_address: z.string().nullable().optional(),
  price:          z.number().positive().nullable().optional(),
  currency:       z.enum(["USD", "CRC"]).nullable().optional(),
  bedrooms:       z.number().int().nonnegative().nullable().optional(),
  bathrooms:      z.number().nonnegative().nullable().optional(),
  area_sqm:       z.number().positive().nullable().optional(),
  floor:          z.number().int().nullable().optional(),
  parking_spaces: z.number().int().nonnegative().nullable().optional(),
  amenities:      z.array(z.string()).nullable().optional(),
})
type ParsedFields = z.infer<typeof ParsedSchema>

export async function POST(req: Request) {
  await requireAuth()

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Voice intake is not configured (OPENAI_API_KEY missing)." },
      { status: 503 },
    )
  }

  const form = await req.formData()
  const audio = form.get("audio")
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: "Falta el audio." }, { status: 400 })
  }
  if (audio.size === 0) {
    return NextResponse.json({ error: "El audio está vacío." }, { status: 400 })
  }
  if (audio.size > 25 * 1024 * 1024) {
    // Whisper hard-caps audio at 25 MB. 60s of WebM is well under this.
    return NextResponse.json({ error: "El audio es demasiado largo." }, { status: 413 })
  }

  // ── 1. Transcribe ──────────────────────────────────────────────
  const ext = blobExt(audio.type)
  let transcript: string
  try {
    const file = await toFile(audio, `voice-intake.${ext}`)
    const result = await client.audio.transcriptions.create({
      file,
      // gpt-4o-mini-transcribe is cheaper than whisper-1 and slightly
      // more accurate for accented Spanish.
      model:       "gpt-4o-mini-transcribe",
      language:    "es",
      // A small priming prompt nudges the model to spell CR-specific
      // proper nouns (Escazú, Santa Ana) correctly without affecting
      // unrelated content.
      prompt:      "Dictado en español de Costa Rica. Inmobiliaria. Zonas: Escazú, Santa Ana, Rohrmoser, Curridabat, Heredia, Tibás.",
    })
    transcript = result.text ?? ""
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown"
    return NextResponse.json({ error: `Transcripción falló: ${msg}` }, { status: 502 })
  }

  if (!transcript.trim()) {
    return NextResponse.json(
      { error: "No detectamos voz en el audio. Probá de nuevo más cerca del micrófono." },
      { status: 422 },
    )
  }

  // ── 2. Extract fields ──────────────────────────────────────────
  let parsed: ParsedFields = {}
  try {
    const completion = await client.chat.completions.create({
      model:           "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature:     0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: `Transcripción:\n"""\n${transcript}\n"""\n\nExtraé los campos en JSON.` },
      ],
    })
    const raw = completion.choices[0]?.message?.content ?? "{}"
    const obj = JSON.parse(raw) as unknown
    const safe = ParsedSchema.safeParse(obj)
    parsed = safe.success ? safe.data : {}
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown"
    // Don't fail the request — return the transcript so the agent can
    // still copy/paste manually. Just signal that parsing didn't work.
    return NextResponse.json({
      transcript,
      parsed: {} as ParsedFields,
      warning: `Extracción falló: ${msg}`,
    })
  }

  return NextResponse.json({ transcript, parsed })
}

// ── Helpers ──────────────────────────────────────────────────────
function blobExt(mime: string): string {
  // MediaRecorder emits browser-native containers. Whisper accepts
  // m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm.
  const m = mime.toLowerCase()
  if (m.includes("webm"))     return "webm"
  if (m.includes("mp4"))      return "mp4"
  if (m.includes("mpeg"))     return "mp3"
  if (m.includes("ogg"))      return "ogg"
  if (m.includes("wav"))      return "wav"
  return "webm"
}

const SYSTEM_PROMPT = `
Sos un extractor de información inmobiliaria. Recibís una transcripción
en español (Costa Rica, voseo) donde un asesor dicta los datos de una
propiedad y devolvés un JSON con los campos que se mencionaron de forma
clara y verificable.

Reglas estrictas:
1. **Nunca inventes valores**. Si no se menciona o no queda claro, usá null.
2. **El JSON debe tener exactamente estas keys**: title, description,
   property_type, listing_type, status, is_furnished, location_mode,
   public_address, price, currency, bedrooms, bathrooms, area_sqm,
   floor, parking_spaces, amenities.
3. Enums permitidos:
   - property_type: "apartment" | "house" | "land" | "commercial" | "office" | "warehouse"
   - listing_type:  "sale" | "rent"  (sale = venta, rent = alquiler)
   - status:        "available" | "reserved" | "sold" | "off_market"
   - location_mode: "exact" | "approximate"
   - currency:      "USD" | "CRC"
4. Mapeos comunes:
   - "venta" / "vender" → listing_type = "sale"
   - "alquiler" / "alquilar" / "rentar" → listing_type = "rent"
   - "apartamento" / "depa" → property_type = "apartment"
   - "casa" → property_type = "house"
   - "terreno" / "lote" → property_type = "land"
   - "local" / "comercial" → property_type = "commercial"
   - "oficina" → property_type = "office"
   - "bodega" → property_type = "warehouse"
   - "amueblado" / "con muebles" → is_furnished = true
   - "sin amueblar" / "vacío" → is_furnished = false
   - "dólares" / "USD" / "$" → currency = "USD"
   - "colones" / "CRC" / "₡" → currency = "CRC"
5. Precios: extraé el número en su moneda original. "ciento ochenta mil"
   = 180000. "1.5 millones" = 1500000.
6. Áreas: en m². "noventa y cinco metros" = 95.
7. **title**: si el dictado no propone un título, dejalo null — la
   página lo arma sola si hace falta.
8. **description**: solo si el dictado contiene una descripción narrativa
   (no solo specs sueltos).
9. **amenities**: array de strings con los términos exactos que el
   asesor mencionó (ej.: "piscina", "gimnasio", "seguridad 24/7").
10. **public_address**: si menciona zona/cantón, ponelo. Ej. "San Rafael
    de Escazú", "Santa Ana centro".
11. Devolvé SOLO el JSON. Nada de prosa antes o después.
`.trim()
