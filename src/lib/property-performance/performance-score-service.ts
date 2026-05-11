// ============================================================
// Performance score — deterministic 0..100 + categorical health.
//
// Inputs combine traffic, lead conversion, listing quality, and
// trend. Each component contributes a weighted sub-score.
//
// We're conservative early in a property's life: a brand-new
// property with 3 days on market and only 12 views shouldn't
// score "low_activity" — we should give it benefit of the doubt
// (set a `is_too_early` floor).
// ============================================================

import type {
  AnalyticsAggregate, LeadFunnelAggregate, ListingQualityReport,
} from "./types"
import type { PerfHealthStatus } from "@/types"

interface Input {
  analytics:        AnalyticsAggregate
  funnel:           LeadFunnelAggregate
  listing_quality:  ListingQualityReport
  days_on_market:   number
}

interface Output {
  score:  number             // 0..100
  status: PerfHealthStatus
  components: {
    visibility:   number     // 0..1
    conversion:   number     // 0..1
    engagement:   number     // 0..1
    quality:      number     // 0..1 (already a pct/100)
    trend:        number     // 0..1
  }
  is_too_early: boolean
}

export function computePerformanceScore({
  analytics, funnel, listing_quality, days_on_market,
}: Input): Output {
  // ── Component sub-scores ───────────────────────────────────

  // Visibility — views per day vs an "expected" baseline. We use
  // 30 views/day as a healthy benchmark (configurable later).
  const expectedViewsPerDay = 30
  const visibility = Math.min(1, analytics.avg_views_per_day / expectedViewsPerDay)

  // Conversion — leads / views. Healthy conversion in real estate is
  // 1-3%. We saturate at 5%.
  const rawConversion = analytics.total_views === 0
    ? 0
    : funnel.total_leads / analytics.total_views
  const conversion = Math.min(1, rawConversion / 0.05)

  // Engagement — share of clicks (whatsapp/call/email/share/gallery)
  // among views. >20% is excellent.
  const totalClicks = Object.values(analytics.total_clicks).reduce((s, v) => s + v, 0)
  const engagementRatio = analytics.total_views === 0
    ? 0
    : totalClicks / analytics.total_views
  const engagement = Math.min(1, engagementRatio / 0.20)

  // Listing quality — already 0..100, normalize.
  const quality = listing_quality.completeness_pct / 100

  // Trend — simple boost / penalty based on direction
  const trend = analytics.traffic_trend === "increasing"
    ? 1
    : analytics.traffic_trend === "stable"
    ? 0.65
    : 0.3

  // ── Weighted blend ─────────────────────────────────────────
  // Weights sum to 1.0
  const weights = {
    visibility: 0.25,
    conversion: 0.30,
    engagement: 0.15,
    quality:    0.20,
    trend:      0.10,
  }

  const raw = (
    visibility * weights.visibility +
    conversion * weights.conversion +
    engagement * weights.engagement +
    quality    * weights.quality    +
    trend      * weights.trend
  )

  const score = Math.round(raw * 100)

  // ── Too-early guard: brand-new properties shouldn't be flagged ──
  // First 3 days of life: status is forced to "healthy" minimum
  // unless score is genuinely strong.
  const is_too_early = days_on_market < 3
  const status = is_too_early && score < 60
    ? "healthy"
    : statusFromScore(score)

  return {
    score,
    status,
    components: { visibility, conversion, engagement, quality, trend },
    is_too_early,
  }
}

function statusFromScore(score: number): PerfHealthStatus {
  if (score >= 80) return "strong"
  if (score >= 60) return "healthy"
  if (score >= 40) return "needs_attention"
  return "low_activity"
}
