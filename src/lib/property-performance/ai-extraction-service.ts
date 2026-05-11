// ============================================================
// AI Extraction — questions + objections from lead text
//
// Reads any free-text we have on a lead (form `message`, agent
// `notes`, future WhatsApp transcript) and extracts:
//
//   • questions[]    Categorized inquiries the lead made
//   • objections[]   Friction points / blockers expressed
//   • sentiment      positive | neutral | negative
//   • urgency        high | medium | low
//
// Output is persisted to `leads.extracted_data` (jsonb) and read
// later by the owner performance report aggregator.
//
// Design choices:
//   - We use a tight predefined taxonomy (NOT free-text categories)
//     so the report can group across leads without normalizing
//     synonyms after the fact.
//   - Empty text → no API call. Saves tokens, returns null.
//   - Idempotent: safe to re-run on the same lead. The result
//     overwrites the previous extraction.
// ============================================================

import OpenAI from "openai"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"

const MODEL = "gpt-4o-mini"

// Canonical taxonomy. Keep this list short — every new entry adds
// noise to the categorization. Bias toward fewer, well-defined
// buckets that map cleanly to what the agent can act on.
export const QUESTION_CATEGORIES = [
  "pets",                  // ¿aceptan mascotas?
  "maintenance_fee",       // ¿cuánto es el mantenimiento?
  "parking",               // ¿tiene parqueo?
  "availability",          // ¿está disponible? ¿desde cuándo?
  "appliances",            // ¿incluye línea blanca?
  "price_negotiation",     // ¿el precio es negociable?
  "visit_schedule",        // ¿se puede visitar X horario?
  "utilities_internet",    // ¿incluye servicios / internet?
  "deposit",               // ¿cuánto de depósito? ¿cuánto de fianza?
  "lease_term",            // ¿plazo mínimo?
  "roommates_party_size",  // ¿se permite roommates / cuántas personas?
  "documents",             // ¿qué documentos pide?
  "other",
] as const

export const OBJECTION_CATEGORIES = [
  "price_high",
  "maintenance_fee_high",
  "pet_policy",
  "parking",
  "location",
  "size",
  "availability_date",
  "missing_appliances",
  "property_condition",
  "lease_term",
  "deposit_amount",
  "no_response",
  "other",
] as const

export type QuestionCategory  = typeof QUESTION_CATEGORIES[number]
export type ObjectionCategory = typeof OBJECTION_CATEGORIES[number]

// Zod schema mirrors the structured output we ask OpenAI to return.
const ExtractionSchema = z.object({
  questions:  z.array(z.enum(QUESTION_CATEGORIES)).max(8),
  objections: z.array(z.enum(OBJECTION_CATEGORIES)).max(8),
  sentiment:  z.enum(["positive", "neutral", "negative"]),
  urgency:    z.enum(["high", "medium", "low"]),
})
export type LeadExtraction = z.infer<typeof ExtractionSchema>

const SYSTEM_PROMPT = `You analyze short text snippets written by or about real-estate leads in Costa Rica.
You extract structured signals that go into a property owner's performance report.

RULES:
- Output ONLY valid JSON matching the requested schema.
- NEVER invent. If the text says nothing about a category, do not include it.
- Use only the categories listed in the schema enums.
- "questions" = explicit asks the lead made.
- "objections" = friction points the lead expressed (price too high, location issues, etc.).
- A category may NOT be in both questions and objections in the same response.
- Empty text or text with no signal → return empty arrays + neutral sentiment + low urgency.
- The text mixes Spanish (Costa Rica voseo) and occasional English.`

export async function extractLeadSignals(text: string): Promise<LeadExtraction | null> {
  const trimmed = text.trim()
  if (trimmed.length < 6) return null

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const completion = await client.chat.completions.create({
    model:           MODEL,
    response_format: { type: "json_object" },
    temperature:     0.1,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Categories allowed:
- questions:  ${QUESTION_CATEGORIES.join(", ")}
- objections: ${OBJECTION_CATEGORIES.join(", ")}

Text to analyze:
"""${trimmed.slice(0, 4000)}"""

Return JSON with keys: questions[], objections[], sentiment, urgency.` },
    ],
  })

  const raw = completion.choices[0]?.message?.content ?? "{}"
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return null }

  const validated = ExtractionSchema.safeParse(parsed)
  if (!validated.success) return null
  return validated.data
}

// ── Persist to a lead row ─────────────────────────────────────
//
// Combines the lead's `notes` and the form `message` (if both exist)
// before extraction so we get the full picture in one call.
//
// Uses the admin client to bypass RLS — this runs server-side from
// the report orchestrator and from on-demand "re-extract" actions.
export async function extractAndPersistLeadSignals(
  leadId: string,
): Promise<LeadExtraction | null> {
  const admin = createAdminClient()

  const { data: lead } = await admin
    .from("leads")
    .select("id, notes")
    .eq("id", leadId)
    .single()

  if (!lead) return null

  const text = (lead.notes ?? "").trim()
  const result = await extractLeadSignals(text)
  if (!result) return null

  await admin
    .from("leads")
    .update({
      extracted_data: {
        ...result,
        extracted_at: new Date().toISOString(),
        model:        MODEL,
      } as never,
    })
    .eq("id", leadId)

  return result
}
