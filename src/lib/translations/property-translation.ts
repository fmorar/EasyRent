import OpenAI from "openai"
import { z } from "zod"
import crypto from "crypto"
import type { Property } from "@/types"

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// ── Schema for AI output ────────────────────────────────────

const TranslationOutputSchema = z.object({
  title:           z.string().min(1),
  description:     z.string().optional().nullable(),
  public_address:  z.string().optional().nullable(),
  seo_title:       z.string().optional().nullable(),
  seo_description: z.string().optional().nullable(),
  highlights:      z.array(z.string()).optional().nullable(),
})

export type TranslationOutput = z.infer<typeof TranslationOutputSchema>

// ── Source hash ─────────────────────────────────────────────

export function computeSourceHash(property: Partial<Property>): string {
  const source = JSON.stringify({
    title:          property.title,
    description:    property.description,
    public_address: property.public_address,
  })
  return crypto.createHash("sha256").update(source).digest("hex").slice(0, 16)
}

// ── Prompt builder ──────────────────────────────────────────

function buildPrompt(property: Partial<Property>, targetLocale: string): string {
  const langName = targetLocale === "en" ? "English" : "Spanish"
  const sourceLang = "Spanish" // origin content is always Spanish

  const fields: Record<string, string | null | undefined> = {
    title:          property.title,
    description:    property.description,
    public_address: property.public_address,
  }

  return `You are a professional real estate copywriter. Translate the following property listing from ${sourceLang} to ${langName}.

Preserve:
- Proper nouns (project names, place names)
- Numbers, prices, measurements
- Technical real estate terminology
- The tone (professional, appealing)

Do NOT translate brand names or project names like "Veloura Residences", "Torre Central", etc.

Return ONLY a JSON object with these keys (omit keys where source value is null/empty):
- title: translated property title
- description: translated description (preserve paragraph structure)
- public_address: translated neighborhood/location string
- seo_title: SEO-optimized title (50-60 chars)
- seo_description: Meta description (150-160 chars)
- highlights: array of 3-5 short bullet highlights in target language

Source data:
${JSON.stringify(fields, null, 2)}`
}

// ── Main translate function ─────────────────────────────────

export async function translateProperty(
  property: Partial<Property>,
  targetLocale: string
): Promise<TranslationOutput> {
  const prompt = buildPrompt(property, targetLocale)

  const response = await client.chat.completions.create({
    model:       "gpt-4o",
    temperature: 0.3,
    messages: [
      {
        role:    "system",
        content: "You are a professional real estate translator. Respond only with valid JSON.",
      },
      {
        role:    "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
  })

  const raw = response.choices[0]?.message?.content
  if (!raw) throw new Error("OpenAI returned empty response")

  const parsed = JSON.parse(raw)
  return TranslationOutputSchema.parse(parsed)
}
