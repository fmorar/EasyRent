// ============================================================
// OpenAI owner-summary service
//
// Receives the deterministic report payload (analytics, funnel,
// listing quality, signals) and generates the owner-facing
// narrative. The model NEVER computes metrics — those are passed
// in pre-computed and the model is instructed to use them verbatim.
//
// Privacy: the input is already the redacted shape (OwnerSafeLead[],
// no PII). Even if the model were compromised it couldn't leak
// names/phones/emails.
// ============================================================

import OpenAI from "openai"
import { z } from "zod"
import type {
  OwnerReportPayload, OwnerReportNarrative, RecommendationSignal,
} from "./types"

const MODEL = "gpt-4o-mini"

// Zod schema for the model's structured output. Strict — any deviation
// throws and the orchestrator catches it.
const NarrativeSchema = z.object({
  executive_summary:              z.string().min(20),
  performance_status:             z.enum(["strong", "healthy", "needs_attention", "low_activity"]),
  performance_status_explanation: z.string().min(10),
  owner_friendly_summary:         z.string().min(20),
  lead_quality_summary:           z.string(),
  engagement_summary:             z.string(),
  traffic_summary:                z.string(),
  main_questions_summary:         z.string(),
  main_objections_summary:        z.string(),
  appointment_summary:            z.string(),
  price_strategy_summary:         z.string(),
  recommended_next_steps: z.array(z.object({
    title:       z.string().min(3),
    description: z.string().min(10),
    priority:    z.enum(["low", "medium", "high"]),
  })).min(2).max(6),
  agent_activity_summary:         z.string(),
  listing_quality_summary:        z.string(),
  owner_message:                  z.string().min(20),
  disclaimer:                     z.string().min(20),
})

const SHARED_RULES = `
RULES YOU MUST FOLLOW:
1. Numbers (views, leads, conversion, score, etc.) come pre-computed.
   USE THEM VERBATIM. Never compute or change a number.
2. The lead list you receive is already redacted to "First L." format
   (e.g. "Maria G."). Refer to leads only as those labels — never
   invent full names, phones, or emails.
3. Keep the tone professional, transparent, owner-facing. Spanish
   uses Costa Rica voseo when speaking directly to the owner
   ("tu propiedad", "podemos sugerir", "te recomendamos"). Avoid
   technical analytics jargon — translate "conversion rate" to
   "tasa de conversión" and explain in plain language.
4. Recommended_next_steps must be CONCRETE and ACTIONABLE.
   Examples: "Bajá el precio a US$1,150 si en 7 días no hay oferta"
   instead of "Considerá ajustar el precio".
5. Always include a disclaimer noting the report is informational
   and doesn't guarantee a sale or rental.
6. Output VALID JSON only matching the requested schema.
7. NEVER claim a sale or rental is certain or guaranteed.`

const SYSTEM_ES = `Sos un analista senior que escribe reportes de desempeño para dueños de propiedades en Costa Rica. Tu trabajo es explicar los datos en un tono profesional, transparente y útil — nunca de marketing.

${SHARED_RULES}

LANGUAGE: Spanish (Costa Rica). Voseo cuando te dirijás al dueño ("tu propiedad", "podés", "vas a", "te recomendamos").`

const SYSTEM_EN = `You are a senior analyst writing property performance reports for property owners in Costa Rica. Explain the data in a professional, transparent, helpful tone — never marketing.

${SHARED_RULES}

LANGUAGE: English, suited for international owners.`

interface GenerateInput {
  payload: Omit<OwnerReportPayload, "narrative">
  /** Locale of the report. Defaults to "es". */
  locale?: "es" | "en"
}

export async function generateOwnerNarrative({
  payload, locale = "es",
}: GenerateInput): Promise<OwnerReportNarrative> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const completion = await client.chat.completions.create({
    model:           MODEL,
    response_format: { type: "json_object" },
    temperature:     0.4,
    messages: [
      { role: "system", content: locale === "en" ? SYSTEM_EN : SYSTEM_ES },
      { role: "user",   content: buildUserPrompt(payload, locale) },
    ],
  })

  const raw = completion.choices[0]?.message?.content ?? "{}"
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch {
    throw new Error("OpenAI returned invalid JSON")
  }

  // Force-overwrite the deterministic fields BEFORE validation. The
  // model isn't allowed to change `performance_status` — we use ours.
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>
    obj.performance_status = payload.performance_status
  }

  const validated = NarrativeSchema.safeParse(parsed)
  if (!validated.success) {
    throw new Error(`OpenAI response failed validation: ${validated.error.issues[0]?.message}`)
  }
  return validated.data
}

// ── Prompt builder ────────────────────────────────────────────
function buildUserPrompt(
  p: Omit<OwnerReportPayload, "narrative">,
  locale: "es" | "en",
): string {
  // Slim the payload before serializing — the model doesn't need every
  // raw event, just the aggregates and signals. Keeps tokens low.
  const compact = {
    property: {
      title:        p.subject.title,
      type:         p.subject.property_type,
      operation:    p.subject.listing_type,
      price:        p.subject.price,
      currency:     p.subject.currency,
      bedrooms:     p.subject.bedrooms,
      bathrooms:    p.subject.bathrooms,
      area_sqm:     p.subject.area_sqm,
      address:      p.subject.display_address,
      published_visible: p.subject.is_marketplace_visible,
    },
    period: p.period,
    metrics: {
      total_views:           p.analytics.total_views,
      unique_visitors:       p.analytics.unique_visitors,
      avg_views_per_day:     p.analytics.avg_views_per_day,
      traffic_trend:         p.analytics.traffic_trend,
      total_clicks:          p.analytics.total_clicks,
      form_starts:           p.analytics.form_starts,
      form_submits:          p.analytics.form_submits,
      conversion_rate:       p.funnel.conversion_rate,
      total_leads:           p.funnel.total_leads,
      qualified_leads:       p.funnel.qualified_leads,
      contacted:             p.funnel.contacted_leads,
      appointments:          p.funnel.appointments_scheduled,
      visits_completed:      p.funnel.visits_completed,
      offers:                p.funnel.offers_received,
      lost_leads:            p.funnel.lost_leads,
    },
    breakdowns: {
      stage:         p.funnel.leads_by_stage,
      interest:      p.funnel.leads_by_interest,
      source:        p.funnel.leads_by_source,
      lost_reasons:  p.funnel.lost_reasons,
    },
    sources: p.analytics.traffic_sources,
    questions:  p.questions_objections.top_questions,
    objections: p.questions_objections.top_objections,
    sentiment:  p.questions_objections.sentiment_breakdown,
    listing_quality: {
      completeness_pct: p.listing_quality.completeness_pct,
      issues: p.listing_quality.checks
        .filter((c) => c.status !== "complete")
        .map((c) => ({ key: c.key, status: c.status, recommendation: c.recommendation })),
    },
    score:  p.performance_score,
    status: p.performance_status,
    signals: p.signals,
    leads_sample: p.leads.slice(0, 10).map((l) => ({
      label:           l.label,
      stage:           l.stage,
      interest:        l.interest_level,
      source:          l.source,
      summary:         l.public_summary,
      appointment_at:  l.appointment_at,
    })),
  }

  const intro = locale === "en"
    ? "Generate the owner-facing performance report. Use the metrics verbatim."
    : "Generá el reporte de desempeño para el dueño. Usá las métricas tal cual."

  // The signals list narrates the dominant direction. We pre-explain
  // each so the model uses them as anchors.
  const signalNarratives: Record<RecommendationSignal, string> = {
    high_views_low_leads:           "Lots of views but very few leads — listing/price not converting",
    low_views:                      "Below-baseline views — needs more distribution or stronger cover",
    many_leads_low_appointments:    "Healthy lead volume but few appointments — friction in pricing/timing/follow-up",
    many_appointments_no_offers:    "Visits happening but no offers — property may not match expectations after visit",
    repeated_price_objection:       "Price is the most-cited objection — consider repositioning or adjustment",
    repeated_pet_policy_question:   "Many leads ask about pets — clarify the policy in the listing",
    missing_listing_information:    "Listing missing important fields — fix to improve conversion",
    strong_performance_keep_price:  "Healthy traffic and engagement — keep price and continue follow-up",
    follow_up_needed:               "Several leads stuck in 'new' — agent should prioritize follow-up",
  }
  const signalContext = p.signals.map((s) => `- ${s}: ${signalNarratives[s]}`).join("\n")

  return `${intro}

## DATA (pre-computed, use verbatim)
${JSON.stringify(compact, null, 2)}

## SIGNAL CONTEXT (anchor your narrative on these)
${signalContext || "(no strong signals — describe steady-state performance)"}

## REQUIRED OUTPUT (JSON only)
{
  "executive_summary": string,
  "performance_status": "strong" | "healthy" | "needs_attention" | "low_activity",
  "performance_status_explanation": string,
  "owner_friendly_summary": string,
  "lead_quality_summary": string,
  "engagement_summary": string,
  "traffic_summary": string,
  "main_questions_summary": string,
  "main_objections_summary": string,
  "appointment_summary": string,
  "price_strategy_summary": string,
  "recommended_next_steps": [
    { "title": string, "description": string, "priority": "low"|"medium"|"high" }
  ],
  "agent_activity_summary": string,
  "listing_quality_summary": string,
  "owner_message": string,
  "disclaimer": string
}

Return JSON only.`
}
