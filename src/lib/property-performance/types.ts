// ============================================================
// Property Performance Report — internal pipeline types
//
// These types travel through the orchestrator:
//   analytics-service → lead-perf-service → listing-quality-service
//   → performance-score-service → recommendation-engine
//   → openai-owner-summary-service → DB persistence
//
// They mirror the shape stored in `property_performance_reports.report_json`
// at the end of the pipeline.
// ============================================================

import type {
  PerfHealthStatus, LeadInterestLevel, LeadLostReason,
} from "@/types"

// ── Subject of the report (snapshot at run time) ────────────────
export interface PerfReportSubject {
  id:                 string
  title:              string
  slug:               string
  property_type:      string
  listing_type:       "sale" | "rent"
  price:              number | null
  currency:           string
  display_address:    string | null
  area_sqm:           number | null
  bedrooms:           number | null
  bathrooms:          number | null
  parking_spaces:     number | null
  amenities:          string[]
  is_furnished:       boolean
  is_marketplace_visible: boolean
  has_anonymous_link: boolean
  cover_url:          string | null
  /** Snapshot of when the property record was created — used as a
   *  proxy for "publication date" since we don't have a separate
   *  `published_at` column yet. */
  created_at:         string
}

// ── Engagement metrics from property_analytics_events ───────────

export interface AnalyticsAggregate {
  total_views:           number
  unique_visitors:       number
  total_clicks: {
    whatsapp:  number
    call:      number
    email:     number
    share:     number
    gallery:   number
    map:       number
    deep_engagement: number
  }
  form_starts:           number
  form_submits:          number
  form_conversion_rate:  number    // submits / starts
  views_by_day:          Array<{ date: string; views: number }>
  avg_views_per_day:     number
  peak_day: { date: string; views: number } | null
  /** Day-over-day trend on the most recent 7 days vs the prior 7 */
  traffic_trend:         "increasing" | "stable" | "decreasing"
  traffic_sources:       Array<{ source: string; views: number; pct: number }>
}

// ── Lead funnel metrics from leads + lead_status_history ────────

export interface LeadFunnelAggregate {
  total_leads:             number
  qualified_leads:         number
  contacted_leads:         number
  appointments_scheduled:  number
  visits_completed:        number
  visits_no_show:          number
  visits_cancelled:        number
  offers_received:         number       // = stage 'negotiating' + 'contract_requested'
  closed_leads:            number
  lost_leads:              number
  conversion_rate:         number       // leads / total_views
  qualified_conversion:    number       // qualified / leads
  appointment_rate:        number       // appointments / qualified
  visit_completion_rate:   number       // visits_completed / appointments
  // Breakdowns
  leads_by_stage:          Array<{ stage: string; count: number }>
  leads_by_interest:       Array<{ level: LeadInterestLevel; count: number }>
  leads_by_source:         Array<{ source: string; count: number }>
  lost_reasons:            Array<{ reason: LeadLostReason; count: number }>
}

// ── Common questions + objections (aggregated from extracted_data) ──

export interface QuestionsObjections {
  top_questions:   Array<{ category: string; count: number }>
  top_objections:  Array<{ category: string; count: number }>
  /** Sentiment distribution of lead messages */
  sentiment_breakdown: { positive: number; neutral: number; negative: number }
  /** Avg urgency score across leads (0..1) */
  avg_urgency: number
}

// ── Listing quality checklist ────────────────────────────────────

export interface ListingQualityCheck {
  key:          string                  // e.g. "has_photos", "has_description"
  status:       "complete" | "partial" | "missing"
  weight:       number                  // 0..1 — drives the score
  recommendation?: string                // shown to the agent in the report
}

export interface ListingQualityReport {
  checks:           ListingQualityCheck[]
  completeness_pct: number               // 0..100
}

// ── Privacy-safe lead summary surfaced to the owner page ────────
//
// The orchestrator turns raw `leads` rows into this shape BEFORE
// passing to OpenAI. The model never sees full names, phones, or
// emails. The public RPC also enforces the same redaction at the
// SQL layer (defense in depth).
export interface OwnerSafeLead {
  label:               string                         // "María G."
  stage:               string
  interest_level:      LeadInterestLevel
  source:              string
  public_summary:      string | null                  // one-liner like "Asked about pet policy"
  appointment_at:      string | null
  appointment_status:  string | null
  created_at:          string
}

// ── Deterministic recommendation signals ────────────────────────
export type RecommendationSignal =
  | "high_views_low_leads"
  | "low_views"
  | "many_leads_low_appointments"
  | "many_appointments_no_offers"
  | "repeated_price_objection"
  | "repeated_pet_policy_question"
  | "missing_listing_information"
  | "strong_performance_keep_price"
  | "follow_up_needed"

// ── Final OpenAI output (validated against zod) ─────────────────
export interface OwnerReportNarrative {
  executive_summary:               string
  performance_status:              PerfHealthStatus
  performance_status_explanation:  string
  owner_friendly_summary:          string
  lead_quality_summary:            string
  engagement_summary:              string
  traffic_summary:                 string
  main_questions_summary:          string
  main_objections_summary:         string
  appointment_summary:             string
  price_strategy_summary:          string
  recommended_next_steps: Array<{
    title:       string
    description: string
    priority:    "low" | "medium" | "high"
  }>
  agent_activity_summary:          string
  listing_quality_summary:         string
  owner_message:                   string
  disclaimer:                      string
}

// ── Top-level report payload (persisted as `report_json`) ───────
export interface OwnerReportPayload {
  subject:              PerfReportSubject
  period: {
    start:  string | null
    end:    string | null
    days:   number     // for "days_on_market"
  }
  analytics:            AnalyticsAggregate
  funnel:               LeadFunnelAggregate
  questions_objections: QuestionsObjections
  listing_quality:      ListingQualityReport
  performance_score:    number
  performance_status:   PerfHealthStatus
  signals:              RecommendationSignal[]
  leads:                OwnerSafeLead[]   // top N by recency, redacted
  narrative:            OwnerReportNarrative
}
