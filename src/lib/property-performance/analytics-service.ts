// ============================================================
// Analytics aggregator — turns property_analytics_events into the
// AnalyticsAggregate shape the report consumes.
//
// Hot path: a single SELECT pulls ALL events for the property in
// the period (excluding bots), then we crunch in-memory. That's
// faster than 6 round-trips for properties with <50k events.
// For very high-traffic properties (>50k events) we'd switch to
// SQL aggregations — TODO when we hit that scale.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import type { AnalyticsAggregate } from "./types"

type EventRow = Pick<
  Database["public"]["Tables"]["property_analytics_events"]["Row"],
  "event_type" | "visitor_id" | "source" | "utm_source" | "utm_medium"
  | "utm_campaign" | "created_at" | "is_bot"
>

interface AggregateInput {
  property_id: string
  period_start: string | null
  period_end:   string | null
}

export async function aggregateAnalytics(
  supabase: SupabaseClient<Database>,
  input:    AggregateInput,
): Promise<AnalyticsAggregate> {
  let query = supabase
    .from("property_analytics_events")
    .select("event_type, visitor_id, source, utm_source, utm_medium, utm_campaign, created_at, is_bot")
    .eq("property_id", input.property_id)
    .eq("is_bot", false)
    .order("created_at", { ascending: true })

  if (input.period_start) query = query.gte("created_at", input.period_start)
  if (input.period_end)   query = query.lte("created_at", input.period_end)

  // Hard cap to avoid pulling millions on a runaway query
  const { data, error } = await query.limit(50_000)
  if (error) throw new Error(`analytics fetch failed: ${error.message}`)

  const rows = (data ?? []) as EventRow[]
  return computeFromRows(rows)
}

function computeFromRows(rows: EventRow[]): AnalyticsAggregate {
  // ── Counters ────────────────────────────────────────────────
  let total_views = 0
  const visitorSet = new Set<string>()
  const clicks = {
    whatsapp: 0, call: 0, email: 0, share: 0,
    gallery: 0, map: 0, deep_engagement: 0,
  }
  let form_starts = 0, form_submits = 0
  const dayBuckets = new Map<string, number>()
  const sourceBuckets = new Map<string, number>()

  for (const r of rows) {
    if (r.event_type === "property_viewed") {
      total_views++
      if (r.visitor_id) visitorSet.add(r.visitor_id)
      const day = r.created_at.slice(0, 10)
      dayBuckets.set(day, (dayBuckets.get(day) ?? 0) + 1)
      // Source attribution — UTM wins, falls back to `source` field,
      // falls back to "direct"
      const src = r.utm_source ?? r.source ?? "direct"
      sourceBuckets.set(src, (sourceBuckets.get(src) ?? 0) + 1)
    }
    else if (r.event_type === "whatsapp_clicked") clicks.whatsapp++
    else if (r.event_type === "call_clicked")     clicks.call++
    else if (r.event_type === "email_clicked")    clicks.email++
    else if (r.event_type === "share_clicked")    clicks.share++
    else if (r.event_type === "gallery_opened")   clicks.gallery++
    else if (r.event_type === "map_opened")       clicks.map++
    else if (r.event_type === "deep_engagement")  clicks.deep_engagement++
    else if (r.event_type === "contact_form_started")    form_starts++
    else if (r.event_type === "contact_form_submitted")  form_submits++
  }

  // ── Day series (sorted ascending) ───────────────────────────
  const views_by_day = [...dayBuckets.entries()]
    .map(([date, views]) => ({ date, views }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const avg_views_per_day = views_by_day.length
    ? Math.round((total_views / views_by_day.length) * 10) / 10
    : 0

  const peak_day = views_by_day.length
    ? views_by_day.reduce((max, d) => (d.views > max.views ? d : max), views_by_day[0])
    : null

  // ── 7-day-vs-prior-7 trend ──────────────────────────────────
  const recent7 = views_by_day.slice(-7).reduce((s, d) => s + d.views, 0)
  const prior7  = views_by_day.slice(-14, -7).reduce((s, d) => s + d.views, 0)
  let traffic_trend: AnalyticsAggregate["traffic_trend"] = "stable"
  if (recent7 > prior7 * 1.15)      traffic_trend = "increasing"
  else if (recent7 < prior7 * 0.85) traffic_trend = "decreasing"

  // ── Source breakdown with percentages ────────────────────────
  const sourceTotal = [...sourceBuckets.values()].reduce((s, v) => s + v, 0)
  const traffic_sources = [...sourceBuckets.entries()]
    .map(([source, views]) => ({
      source,
      views,
      pct: sourceTotal === 0 ? 0 : Math.round((views / sourceTotal) * 100),
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 8)

  return {
    total_views,
    unique_visitors:      visitorSet.size,
    total_clicks:         clicks,
    form_starts,
    form_submits,
    form_conversion_rate: form_starts === 0
      ? 0
      : Math.round((form_submits / form_starts) * 100) / 100,
    views_by_day,
    avg_views_per_day,
    peak_day,
    traffic_trend,
    traffic_sources,
  }
}
