// ============================================================
// OpenAI Report Service
//
// Generates the owner-facing narrative around the deterministic
// pricing engine output. The model NEVER chooses a price — we
// pass the engine's recommended_price/min/max and instruct the
// model to use them verbatim. We then validate the response
// with Zod and double-check the prices match.
//
// Languages: report locale 'es' (default) or 'en'.
// ============================================================

import OpenAI from "openai"
import {
  OpenAIMarketReportSchema,
  type OpenAIMarketReportOutput,
} from "./schemas"
import type {
  NormalizedListing, PricingMetrics, SubjectProperty,
} from "./types"
import type { SiteAnalysis } from "./site-analysis-service"

const MODEL = "gpt-4o-mini"

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface GenerateInput {
  subject:       SubjectProperty
  comparables:   NormalizedListing[]   // valid (used) only
  excluded:      NormalizedListing[]
  metrics:       PricingMetrics
  report_locale: "es" | "en"
  /** Public-maps site analysis (POIs, distances, walkability). Used
   *  to ground `location_insights` in concrete numbers instead of
   *  generic copy. May be null when coords are unavailable or Overpass
   *  failed — the model should still produce text from `display_address`. */
  site_analysis?: SiteAnalysis | null
}

export async function generateAiReport(
  input: GenerateInput,
): Promise<OpenAIMarketReportOutput> {
  const { subject, comparables, excluded, metrics, report_locale, site_analysis } = input

  const system = report_locale === "en" ? SYSTEM_EN : SYSTEM_ES
  const user   = buildUserPrompt(
    subject, comparables, excluded, metrics, report_locale, site_analysis ?? null,
  )

  const completion = await client.chat.completions.create({
    model:           MODEL,
    response_format: { type: "json_object" },
    temperature:     0.4,
    messages: [
      { role: "system", content: system },
      { role: "user",   content: user },
    ],
  })

  const raw = completion.choices[0]?.message?.content ?? "{}"
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("OpenAI returned invalid JSON")
  }

  // Force-overwrite the deterministic fields BEFORE validation —
  // even if the model tries to "improve" them, ours win.
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>
    obj.recommended_price     = metrics.recommendedPrice
    obj.recommended_price_min = metrics.recommendedPriceMin
    obj.recommended_price_max = metrics.recommendedPriceMax
    obj.currency              = metrics.currency
    obj.confidence_label      = metrics.confidenceLabel
    if (obj.pricing_scenarios && typeof obj.pricing_scenarios === "object") {
      const ps = obj.pricing_scenarios as Record<string, { price?: number; description?: string }>
      ps.aggressive   = { price: metrics.aggressivePrice,   description: ps.aggressive?.description ?? "" }
      ps.balanced     = { price: metrics.balancedPrice,     description: ps.balanced?.description ?? "" }
      ps.aspirational = { price: metrics.aspirationalPrice, description: ps.aspirational?.description ?? "" }
    }
    // Site analysis is engine-authored — overwrite even if the model
    // hallucinated something here.
    obj.site_analysis = site_analysis ?? null
  }

  const validated = OpenAIMarketReportSchema.safeParse(parsed)
  if (!validated.success) {
    throw new Error(`OpenAI response failed validation: ${validated.error.issues[0]?.message}`)
  }

  return validated.data
}

// ── Prompts ──────────────────────────────────────────────────────
const SHARED_RULES = `
RULES YOU MUST FOLLOW:
1. You are NOT pricing the property. The deterministic engine has already
   computed recommended_price, recommended_price_min, recommended_price_max
   and the three pricing_scenarios. Use them VERBATIM. Do not change them.
2. Your job: write the explanatory narrative — executive summary, market
   position, rationale, risks, opportunities, strategy.
3. Tone: professional, owner-facing, trustworthy, easy to read. No jargon.
4. Costa Rica context. Use proper local market terminology.
5. Always include a disclaimer that the report is based on PUBLIC ACTIVE
   LISTING prices, not final closing prices.
6. Output strictly valid JSON matching the requested schema. No prose
   outside the JSON.`

const SYSTEM_ES = `Sos un analista inmobiliario senior especializado en el mercado costarricense. Escribís reportes claros y profesionales para dueños de propiedades, en español neutro con voseo cuando corresponda. Tu trabajo NO es decidir el precio — los números ya están calculados. Tu trabajo es explicarlos de forma clara y útil.

${SHARED_RULES}

LANGUAGE: Spanish (Costa Rica), voseo when addressing the owner directly.`

const SYSTEM_EN = `You are a senior real-estate analyst specializing in the Costa Rica market. You write clear, professional reports for property owners. Your job is NOT to set the price — the numbers are already computed. Your job is to explain them clearly and usefully.

${SHARED_RULES}

LANGUAGE: English, suited for international owners.`

function buildUserPrompt(
  subject: SubjectProperty,
  comps: NormalizedListing[],
  excluded: NormalizedListing[],
  m: PricingMetrics,
  locale: "es" | "en",
  site: SiteAnalysis | null,
): string {
  const compactComps = comps.slice(0, 30).map((c) => ({
    title:        c.title,
    price:        c.price,
    currency:     c.currency,
    area_m2:      c.built_area_m2,
    bedrooms:     c.bedrooms,
    bathrooms:    c.bathrooms,
    location:     c.location_text,
    canton:       c.canton,
    district:     c.district,
    similarity:   c.similarity_score,
    is_outlier:   c.is_outlier,
    price_per_m2: c.price_per_m2 ? Math.round(c.price_per_m2) : null,
    listing_url:  c.listing_url,
  }))

  const excludedSummary = excluded.slice(0, 20).map((c) => ({
    title:  c.title,
    reason: c.exclusion_reason,
  }))

  const subjectSummary = {
    title:           subject.title,
    property_type:   subject.property_type,
    listing_type:    subject.listing_type,
    bedrooms:        subject.bedrooms,
    bathrooms:       subject.bathrooms,
    parking_spaces:  subject.parking_spaces,
    area_m2:         subject.area_sqm,
    maintenance_fee: subject.maintenance_fee,
    address:         subject.display_address,
    province:        subject.province,
    canton:          subject.canton,
    district:        subject.district,
    amenities:       subject.amenities,
    is_furnished:    subject.is_furnished,
  }

  const intro = locale === "en"
    ? "Generate the owner-facing market analysis report. Use the deterministic numbers verbatim."
    : "Generá el reporte de análisis de mercado para el dueño. Usá los números deterministas tal cual."

  return `${intro}

## SUBJECT PROPERTY
${JSON.stringify(subjectSummary, null, 2)}

## DETERMINISTIC PRICING METRICS (use these values verbatim)
${JSON.stringify({
  currency:               m.currency,
  recommended_price:      m.recommendedPrice,
  recommended_price_min:  m.recommendedPriceMin,
  recommended_price_max:  m.recommendedPriceMax,
  confidence_score:       m.confidenceScore,
  confidence_label:       m.confidenceLabel,
  weighted_price_per_m2:  m.weightedPricePerM2,
  median_price_per_m2:    m.medianPricePerM2,
  valid_comparables:      m.validComparables,
  excluded_listings:      m.excludedListings,
  outliers_detected:      m.outliersDetected,
  scenarios: {
    aggressive:   m.aggressivePrice,
    balanced:     m.balancedPrice,
    aspirational: m.aspirationalPrice,
  },
}, null, 2)}

## VALID COMPARABLES (top 30 by similarity)
${JSON.stringify(compactComps, null, 2)}

## EXCLUDED (sample)
${JSON.stringify(excludedSummary, null, 2)}

## SITE ANALYSIS (public maps · OpenStreetMap)
${
  site
    ? JSON.stringify({
        environment:    site.environment,
        walkability:    site.walkability,
        counts_500m:    site.counts.r500m,
        counts_1km:     site.counts.r1km,
        counts_2km:     site.counts.r2km,
        nearest:        site.nearest,
        landmarks:      site.landmarks,
        coverage_note:  site.coverage_note ?? null,
      }, null, 2)
    : "null  (Site analysis unavailable. Use display_address only.)"
}

GROUND ${locale === "en" ? '"location_insights"' : '"location_insights"'} IN THE SITE ANALYSIS DATA ABOVE
WHEN PRESENT — cite specific distances ("hospital a 1.2 km", "parada de bus
a 240 m") and counts ("3 supermercados en 1 km"). Do NOT invent numbers.
If site analysis is null, fall back to address-level commentary only.

## REQUIRED OUTPUT (JSON only, no prose)
{
  "executive_summary": string,
  "recommended_price": number,
  "recommended_price_min": number,
  "recommended_price_max": number,
  "currency": "USD" | "CRC",
  "confidence_label": "Low" | "Medium" | "High",
  "confidence_explanation": string,
  "market_position": string,
  "pricing_rationale": string,
  "owner_friendly_explanation": string,
  "competitive_summary": string,
  "location_insights": string,
  "amenities_insights": string,
  "risks": string[],
  "opportunities": string[],
  "suggested_listing_strategy": {
    "initial_listing_price": number,
    "negotiation_floor": number,
    "review_after_days": number,
    "strategy_explanation": string
  },
  "pricing_scenarios": {
    "aggressive":   { "price": number, "description": string },
    "balanced":     { "price": number, "description": string },
    "aspirational": { "price": number, "description": string }
  },
  "methodology": string,
  "limitations": string[],
  "disclaimer": string
}

Respond with the JSON object only.`
}
