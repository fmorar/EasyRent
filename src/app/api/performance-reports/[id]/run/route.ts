// ============================================================
// POST /api/performance-reports/[id]/run
//
// Orchestrates the full owner performance report pipeline:
//   1. Mark report `processing`, log event
//   2. Snapshot subject (property + photos)
//   3. Aggregate analytics events  → AnalyticsAggregate
//   4. Aggregate leads + funnel    → LeadFunnelAggregate
//   5. Aggregate Q+O from extracted_data
//   6. Evaluate listing quality
//   7. Compute deterministic score + status
//   8. Compute recommendation signals
//   9. Compose privacy-safe owner_leads sample
//  10. Call OpenAI → narrative
//  11. Persist report_json + score + status + status='active'
//  12. Log completion
//
// Long-running: ~10-30s typical. Uses nodejs runtime + 300s.
// ============================================================

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { aggregateAnalytics } from "@/lib/property-performance/analytics-service"
import {
  aggregateLeadPerformance, aggregateQuestionsObjections,
} from "@/lib/property-performance/lead-performance-service"
import { evaluateListingQuality } from "@/lib/property-performance/listing-quality-service"
import { computePerformanceScore } from "@/lib/property-performance/performance-score-service"
import { computeRecommendationSignals } from "@/lib/property-performance/recommendation-engine"
import { generateOwnerNarrative } from "@/lib/property-performance/openai-owner-summary-service"
import type {
  OwnerReportPayload, PerfReportSubject,
} from "@/lib/property-performance/types"
import type { Lead, Property } from "@/types"

export const runtime     = "nodejs"
export const maxDuration = 300

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params
  const { profile } = await requireAuth()
  const supabase = await createClient()

  // ── Load report ──────────────────────────────────────────
  const { data: report, error: rErr } = await supabase
    .from("property_performance_reports")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (rErr || !report) {
    return NextResponse.json({ error: "report_not_found" }, { status: 404 })
  }

  // Only the original creator can regenerate. Recipients who can view
  // the report (via a property share) get read-only access — they
  // shouldn't trigger a new pipeline run on someone else's property.
  if (report.created_by !== profile.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  // Mark processing
  await supabase
    .from("property_performance_reports")
    .update({ status: "processing", error_message: null })
    .eq("id", id)
  await logEvent(id, "pipeline_started", "Pipeline started.")

  try {
    // ── 1. Subject snapshot ────────────────────────────────
    const { data: prop } = await supabase
      .from("properties")
      .select("*")
      .eq("id", report.property_id)
      .is("deleted_at", null)
      .single()

    if (!prop) throw new Error("Property not found")

    const { data: photoRow } = await supabase
      .from("property_photos")
      .select("url, is_cover, order_index")
      .eq("property_id", report.property_id)
      .order("is_cover", { ascending: false })
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle()

    const { count: photoCount = 0 } = await supabase
      .from("property_photos")
      .select("id", { count: "exact", head: true })
      .eq("property_id", report.property_id)

    const subject: PerfReportSubject = {
      id:                     prop.id,
      title:                  prop.title,
      slug:                   prop.slug,
      property_type:          prop.property_type,
      listing_type:           prop.listing_type,
      price:                  prop.price == null ? null : Number(prop.price),
      currency:               prop.currency,
      display_address:        prop.display_address,
      area_sqm:               prop.area_sqm == null ? null : Number(prop.area_sqm),
      bedrooms:               prop.bedrooms,
      bathrooms:              prop.bathrooms,
      parking_spaces:         prop.parking_spaces,
      amenities:              prop.amenities ?? [],
      is_furnished:           prop.is_furnished,
      is_marketplace_visible: prop.is_marketplace_visible,
      has_anonymous_link:     !!prop.anonymous_slug,
      cover_url:              photoRow?.url ?? null,
      created_at:             prop.created_at,
    }

    // ── 2. Period ──────────────────────────────────────────
    const periodStart = report.report_period_start ?? prop.created_at
    const periodEnd   = report.report_period_end   ?? new Date().toISOString()
    const days        = Math.max(
      1,
      Math.ceil(
        (new Date(periodEnd).getTime() - new Date(periodStart).getTime()) /
        (24 * 60 * 60 * 1000),
      ),
    )

    // ── 3. Analytics ──────────────────────────────────────
    await logEvent(id, "aggregating_analytics", "Aggregating analytics events…")
    const analytics = await aggregateAnalytics(supabase, {
      property_id:  report.property_id,
      period_start: periodStart,
      period_end:   periodEnd,
    })

    // ── 4. Leads + funnel ─────────────────────────────────
    await logEvent(id, "aggregating_leads", "Aggregating lead funnel…")
    const { funnel, owner_leads } = await aggregateLeadPerformance(supabase, {
      property_id:  report.property_id,
      period_start: periodStart,
      period_end:   periodEnd,
    })
    funnel.conversion_rate = analytics.total_views === 0
      ? 0
      : Math.round((funnel.total_leads / analytics.total_views) * 1000) / 1000

    // ── 5. Q+O from extracted_data ────────────────────────
    const { data: leadsForExtract } = await supabase
      .from("leads")
      .select("extracted_data")
      .eq("property_id", report.property_id)
      .is("deleted_at", null)
      .eq("is_archived", false)
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd)
      .limit(2000)
    const questions_objections = aggregateQuestionsObjections(
      (leadsForExtract ?? []) as Pick<Lead, "extracted_data">[] as Lead[],
    )

    // ── 6. Listing quality ────────────────────────────────
    const listing_quality = evaluateListingQuality({
      property:    prop as Property,
      photo_count: photoCount ?? 0,
    })

    // ── 7. Score + status ─────────────────────────────────
    const scoreOutput = computePerformanceScore({
      analytics, funnel, listing_quality, days_on_market: days,
    })

    // ── 8. Signals ────────────────────────────────────────
    const signals = computeRecommendationSignals({
      analytics, funnel, questions_objections,
      listing_quality, days_on_market: days,
    })

    // ── 9. Compose payload (no narrative yet) ─────────────
    const payloadWithoutNarrative: Omit<OwnerReportPayload, "narrative"> = {
      subject,
      period: { start: periodStart, end: periodEnd, days },
      analytics,
      funnel,
      questions_objections,
      listing_quality,
      performance_score:  scoreOutput.score,
      performance_status: scoreOutput.status,
      signals,
      leads:              owner_leads,
    }

    // ── 10. AI narrative (with fallback) ──────────────────
    await logEvent(id, "calling_openai", "Generating owner narrative…")
    let narrative: OwnerReportPayload["narrative"]
    try {
      narrative = await generateOwnerNarrative({
        payload: payloadWithoutNarrative,
        locale:  "es",
      })
    } catch (err) {
      // Fallback narrative — still ship the report with deterministic
      // numbers even if OpenAI fails. The owner sees real metrics
      // and a generic explanation.
      await logEvent(id, "openai_failed",
        err instanceof Error ? err.message : "openai error")
      narrative = buildFallbackNarrative(payloadWithoutNarrative)
    }

    const fullPayload: OwnerReportPayload = {
      ...payloadWithoutNarrative,
      narrative,
    }

    // ── 11. Persist ───────────────────────────────────────
    await supabase
      .from("property_performance_reports")
      .update({
        status:             "active",
        performance_score:  scoreOutput.score,
        performance_status: scoreOutput.status,
        summary:            narrative.executive_summary,
        report_json:        fullPayload as never,
        last_generated_at:  new Date().toISOString(),
      })
      .eq("id", id)

    await logEvent(id, "report_completed", "Report completed.")
    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    await supabase
      .from("property_performance_reports")
      .update({ status: "failed", error_message: msg })
      .eq("id", id)
    await logEvent(id, "report_failed", msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

// ── Helpers ──────────────────────────────────────────────────
async function logEvent(
  reportId: string,
  type:     string,
  message:  string,
  metadata: Record<string, unknown> = {},
) {
  const supabase = await createClient()
  await supabase.from("property_performance_report_events").insert({
    report_id:  reportId,
    event_type: type,
    message,
    metadata:   metadata as unknown as never,
  })
}

// Fallback narrative used when OpenAI fails — keeps the report
// shippable with the deterministic numbers + a generic frame.
function buildFallbackNarrative(
  p: Omit<OwnerReportPayload, "narrative">,
): OwnerReportPayload["narrative"] {
  const status = p.performance_status
  const lostHi  = p.funnel.lost_leads >= 3 ? p.funnel.lost_leads : 0

  return {
    executive_summary:
      `Tu propiedad recibió ${p.analytics.total_views} vistas y ${p.funnel.total_leads} leads en este período. ` +
      `El nivel de desempeño actual es ${status}.`,
    performance_status: p.performance_status,
    performance_status_explanation: "Basado en visibilidad, conversión, engagement, calidad del anuncio y tendencia.",
    owner_friendly_summary: "Te compartimos el resumen de la actividad reciente del anuncio.",
    lead_quality_summary: "El reporte agrupa los leads por nivel de interés, fuente y etapa del pipeline.",
    engagement_summary: "Los clicks de WhatsApp, llamadas y compartir indican qué tanto interactúa la audiencia con el anuncio.",
    traffic_summary: `Promedio de ${p.analytics.avg_views_per_day} vistas por día.`,
    main_questions_summary: p.questions_objections.top_questions.length === 0
      ? "Aún no hay un patrón claro de preguntas."
      : `Las consultas más frecuentes son sobre: ${p.questions_objections.top_questions.map((q) => q.category).join(", ")}.`,
    main_objections_summary: p.questions_objections.top_objections.length === 0
      ? "Aún no hay objeciones recurrentes."
      : `Las objeciones más comunes son: ${p.questions_objections.top_objections.map((o) => o.category).join(", ")}.`,
    appointment_summary: `${p.funnel.appointments_scheduled} citas agendadas, ${p.funnel.visits_completed} visitas completadas.`,
    price_strategy_summary: "Mantenemos el precio actual hasta tener más datos. Revisaremos en 7 días.",
    recommended_next_steps: [
      { title: "Hacer seguimiento a leads",
        description: "Priorizá los leads recientes que aún no han sido contactados.",
        priority: "high" },
      { title: "Mejorar el anuncio",
        description: "Revisá fotos, descripción y campos faltantes para subir la calidad del anuncio.",
        priority: "medium" },
    ],
    agent_activity_summary: `${p.funnel.contacted_leads} leads contactados de un total de ${p.funnel.total_leads}.`,
    listing_quality_summary: `Completitud del anuncio: ${p.listing_quality.completeness_pct}%.`,
    owner_message: lostHi > 0
      ? `Detectamos ${lostHi} leads perdidos en este período. Vamos a revisar las razones para mejorar el match con futuros interesados.`
      : "Vamos a seguir trabajando para mejorar el desempeño del anuncio.",
    disclaimer:
      "Este reporte se basa en la actividad de la plataforma, información de leads y datos disponibles del anuncio. " +
      "Su objetivo es apoyar decisiones de precio y comercialización, pero no garantiza la venta o alquiler de la propiedad.",
  }
}
