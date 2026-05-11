// ============================================================
// Recommendation engine — emits deterministic signals BEFORE
// OpenAI sees the report. Each signal has a clear precondition
// expressed in code, and the AI uses them as anchors so it
// doesn't invent insights the data doesn't support.
//
// Order matters: the strongest signal goes first, since the
// owner narrative leads with the first 1-2 signals.
// ============================================================

import type {
  AnalyticsAggregate, LeadFunnelAggregate,
  QuestionsObjections, ListingQualityReport,
  RecommendationSignal,
} from "./types"

interface Input {
  analytics:            AnalyticsAggregate
  funnel:               LeadFunnelAggregate
  questions_objections: QuestionsObjections
  listing_quality:      ListingQualityReport
  days_on_market:       number
}

export function computeRecommendationSignals(input: Input): RecommendationSignal[] {
  const { analytics, funnel, questions_objections, listing_quality, days_on_market } = input
  const out: RecommendationSignal[] = []

  // ── Top objection / question patterns ─────────────────────
  // (most actionable signals — surface first)
  const topObjection = questions_objections.top_objections[0]
  if (topObjection?.category === "price_high" && topObjection.count >= 3) {
    out.push("repeated_price_objection")
  }
  const topQuestion = questions_objections.top_questions[0]
  if (topQuestion?.category === "pets" && topQuestion.count >= 3) {
    out.push("repeated_pet_policy_question")
  }

  // ── Funnel anomalies ──────────────────────────────────────
  const totalViews = analytics.total_views
  const conversion = totalViews === 0 ? 0 : funnel.total_leads / totalViews

  if (totalViews >= 100 && conversion < 0.01) {
    // Lots of eyeballs, very few leads — listing or price isn't converting
    out.push("high_views_low_leads")
  }

  if (analytics.avg_views_per_day < 5 && days_on_market >= 7) {
    out.push("low_views")
  }

  if (funnel.total_leads >= 5 && funnel.appointment_rate < 0.2) {
    out.push("many_leads_low_appointments")
  }

  if (funnel.appointments_scheduled >= 3 && funnel.offers_received === 0) {
    out.push("many_appointments_no_offers")
  }

  // ── Listing quality ───────────────────────────────────────
  if (listing_quality.completeness_pct < 70) {
    out.push("missing_listing_information")
  }

  // ── Operational ──────────────────────────────────────────
  // "follow_up_needed": leads that are stuck in `new` or `contacted`
  // for too long.
  const stuckCount = funnel.leads_by_stage.find((s) => s.stage === "new")?.count ?? 0
  if (stuckCount >= 3) out.push("follow_up_needed")

  // ── Positive signal ──────────────────────────────────────
  // "strong_performance_keep_price": healthy traffic + healthy
  // conversion + at least 1 appointment scheduled.
  if (
    totalViews >= 50 &&
    conversion >= 0.02 &&
    funnel.appointments_scheduled >= 1 &&
    out.length === 0   // no other concerning signal fired
  ) {
    out.push("strong_performance_keep_price")
  }

  return out
}
