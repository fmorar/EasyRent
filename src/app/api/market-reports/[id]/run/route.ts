// ============================================================
// POST /api/market-reports/[id]/run
//
// Orchestrates the full pipeline:
//   1. Mark report processing
//   2. Re-detect sources, crawl listings
//   3. Normalize + currency-convert
//   4. Filter, score similarity, compute pricing
//   5. Call OpenAI (M4)
//   6. Persist comparables, events, final fields
//
// Long-running — uses Node runtime + 300s max duration.
// ============================================================

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { detectSource } from "@/lib/market-analysis/source-detector"
import { crawlSource } from "@/lib/market-analysis/crawler"
import { normalizeListing } from "@/lib/market-analysis/normalizers"
import { getUsdToCrcRate, convertToUsd, convertToCrc } from "@/lib/market-analysis/exchange-rate-service"
import { filterComparables } from "@/lib/market-analysis/comparable-filter"
import { scoreSimilarity } from "@/lib/market-analysis/similarity-score"
import { computePricing } from "@/lib/market-analysis/pricing-engine"
import { generateAiReport } from "@/lib/market-analysis/openai-report-service"
import { getSiteAnalysis } from "@/lib/market-analysis/site-analysis-service"
import type {
  MarketFilterConfig, NormalizedListing, SubjectProperty,
} from "@/lib/market-analysis/types"
import type { SiteAnalysis } from "@/lib/market-analysis/site-analysis-service"

export const runtime     = "nodejs"
export const maxDuration = 300

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params
  await requireAuth()
  const supabase = await createClient()

  // ── Load report + verify ownership via RLS ─────────────────
  const { data: report, error: rErr } = await supabase
    .from("market_reports")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (rErr || !report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 })
  }

  // Mark processing
  await supabase.from("market_reports").update({ status: "processing", error_message: null }).eq("id", id)
  await logEvent(id, "crawling_started", "Pipeline started.")

  try {
    // ── 1. Subject property ──────────────────────────────────
    const { data: prop } = await supabase
      .from("properties")
      .select(`
        id, title, slug, property_type, listing_type,
        bedrooms, bathrooms, parking_spaces, area_sqm, maintenance_fee,
        price, currency, display_address, display_lat, display_lng,
        amenities, is_furnished
      `)
      .eq("id", report.property_id)
      .single()
    if (!prop) throw new Error("Subject property not found")

    const subject: SubjectProperty = {
      id:              prop.id,
      title:           prop.title,
      slug:            prop.slug,
      property_type:   prop.property_type,
      listing_type:    prop.listing_type,
      bedrooms:        prop.bedrooms,
      bathrooms:       prop.bathrooms,
      parking_spaces:  prop.parking_spaces,
      area_sqm:        prop.area_sqm == null ? null : Number(prop.area_sqm),
      maintenance_fee: prop.maintenance_fee == null ? null : Number(prop.maintenance_fee),
      price:           prop.price == null ? null : Number(prop.price),
      currency:        prop.currency,
      display_address: prop.display_address,
      display_lat:     prop.display_lat == null ? null : Number(prop.display_lat),
      display_lng:     prop.display_lng == null ? null : Number(prop.display_lng),
      amenities:       prop.amenities ?? [],
      is_furnished:    prop.is_furnished,
    }

    // ── 1b. Site analysis (public maps) ──────────────────────
    // Fire the Overpass call early — runs in parallel with the
    // crawl below and the result is awaited just before the AI step.
    // Returns null on coverage gaps / Overpass failure; the rest of
    // the pipeline must keep working in that case.
    let siteAnalysisPromise: Promise<SiteAnalysis | null> = Promise.resolve(null)
    if (subject.display_lat != null && subject.display_lng != null) {
      siteAnalysisPromise = getSiteAnalysis(subject.display_lat, subject.display_lng)
        .catch(() => null)
    }

    // ── 2. Sources + crawl ───────────────────────────────────
    const meta = (report.metadata ?? {}) as Record<string, unknown>
    const filters = (meta.filters ?? {}) as MarketFilterConfig
    const scanDepth = Number(meta.scan_depth ?? 3)
    const maxListings = Number(meta.max_listings ?? 60)

    const { data: sourceRows } = await supabase
      .from("market_report_sources")
      .select("*")
      .eq("report_id", id)

    if (!sourceRows || sourceRows.length === 0) {
      throw new Error("No sources configured for report")
    }

    const allCrawled: NormalizedListing[] = []
    let totalRemaining = maxListings

    for (const src of sourceRows) {
      if (totalRemaining <= 0) break
      const det = detectSource(src.source_url)
      if (det.source_type === "unsupported") {
        await supabase.from("market_report_sources")
          .update({ status: "unsupported", error_message: "URL type unsupported." })
          .eq("id", src.id)
        continue
      }

      await supabase.from("market_report_sources")
        .update({ status: "processing" })
        .eq("id", src.id)

      const result = await crawlSource(src.source_url, {
        scanDepth,
        maxListings: Math.min(totalRemaining, maxListings),
      })

      if (result.error) {
        await supabase.from("market_report_sources").update({
          status: "failed",
          error_message: result.error,
          source_name: result.sourceName,
          source_type: result.urlType === "unsupported" ? null : result.urlType,
        }).eq("id", src.id)
        await logEvent(id, "report_failed", `Source failed: ${result.error}`, { source_id: src.id })
        continue
      }

      const normalized = result.listings.map((c) => {
        const n = normalizeListing(c)
        n.source_name = result.sourceName
        n.source_url  = src.source_url
        return n
      })
      allCrawled.push(...normalized)
      totalRemaining -= normalized.length

      await supabase.from("market_report_sources").update({
        status:         "completed",
        source_name:    result.sourceName,
        source_type:    result.urlType === "unsupported" ? null : result.urlType,
        pages_scanned:  result.pagesScanned,
        listings_found: normalized.length,
      }).eq("id", src.id)

      await logEvent(id, "page_scanned",
        `Scanned ${result.pagesScanned} page(s) — ${normalized.length} listings`,
        { source_id: src.id })
    }

    await logEvent(id, "listings_extracted", `Total raw comparables: ${allCrawled.length}`)

    // ── 3. Currency conversion ───────────────────────────────
    const fx = await getUsdToCrcRate(supabase)
    await logEvent(id, "exchange_rate_applied",
      `USD→CRC: ${fx.rate.toFixed(2)} (${fx.source})`)

    const targetCurrency: "USD" | "CRC" = (report.currency === "CRC" ? "CRC" : "USD")
    for (const c of allCrawled) {
      if (c.price != null && c.currency) {
        c.price_usd = convertToUsd(c.price, c.currency, fx.rate)
        c.price_crc = convertToCrc(c.price, c.currency, fx.rate)
        // Re-express in target for engine math
        const targetPrice = targetCurrency === "USD" ? c.price_usd : c.price_crc
        c.price = targetPrice
        c.currency = targetCurrency
        if (c.built_area_m2 && c.built_area_m2 > 0) {
          c.price_per_m2 = c.price / c.built_area_m2
        }
      }
    }

    // ── 4. Filter ────────────────────────────────────────────
    const { kept, excluded } = filterComparables(subject, allCrawled, filters)
    await logEvent(id, "comparables_filtered",
      `Kept ${kept.length}, excluded ${excluded.length}`)

    // ── 5. Similarity ────────────────────────────────────────
    for (const c of kept) {
      const { score, confidence } = scoreSimilarity(subject, c)
      c.similarity_score = score
      c.confidence_score = confidence
    }

    // ── 6. Pricing engine ────────────────────────────────────
    const { metrics, validUsed, outliersFound } = computePricing({
      subject, comparables: kept, currency: targetCurrency, filters,
    })

    if (outliersFound.length > 0) {
      await logEvent(id, "outliers_detected",
        `${outliersFound.length} outlier(s) excluded by IQR`)
    }
    await logEvent(id, "pricing_calculated",
      `Recommended: ${metrics.recommendedPrice} ${targetCurrency} (${metrics.confidenceLabel})`)

    // ── 7. Persist comparables ───────────────────────────────
    // Wipe previous rows from regenerations
    await supabase.from("market_report_comparables").delete().eq("report_id", id)

    const allToPersist: NormalizedListing[] = [
      ...validUsed.map((c) => ({ ...c, is_outlier: false })),
      ...outliersFound,
      ...excluded,
    ]
    if (allToPersist.length > 0) {
      const payload = allToPersist.map((c) => toComparableInsert(id, c))
      // Insert in chunks of 50 to stay under Supabase request limits.
      // Cast through unknown — the runtime Json type is too strict for
      // our optional Record<string, unknown> extracted_data field.
      for (let i = 0; i < payload.length; i += 50) {
        await supabase.from("market_report_comparables").insert(payload.slice(i, i + 50) as unknown as never)
      }
    }

    // ── 7b. Resolve site analysis ────────────────────────────
    // Now that the heavy work is done, await the Overpass result
    // we kicked off back in step 1b. If it failed or returned null
    // (no coords / coverage gap / Overpass down), we proceed without.
    const siteAnalysis = await siteAnalysisPromise
    if (siteAnalysis) {
      const c = siteAnalysis.counts.r1km
      const summary = `1 km: ${c.supermarkets} super, ${c.schools} esc, ` +
        `${c.parks} parques, ${c.transit_stops} transp · walkability ${siteAnalysis.walkability.tier}`
      await logEvent(id, "site_analysis_completed", summary)
    } else {
      await logEvent(id, "site_analysis_completed",
        "Site analysis unavailable (no coords or Overpass failed).")
    }

    // ── 8. AI report ─────────────────────────────────────────
    let aiResult: Awaited<ReturnType<typeof generateAiReport>> | null = null
    try {
      aiResult = await generateAiReport({
        subject,
        comparables: validUsed,
        excluded,
        metrics,
        report_locale: report.report_locale === "en" ? "en" : "es",
        site_analysis: siteAnalysis,
      })
      await logEvent(id, "openai_report_generated", "AI report generated.")
    } catch (err) {
      // Log but don't fail — we still have the deterministic numbers.
      await logEvent(id, "report_failed",
        `AI generation failed: ${err instanceof Error ? err.message : "unknown"}`)
    }

    // ── 9. Save report + complete ────────────────────────────
    // When AI failed but site analysis succeeded, we still want the
    // public report to render the site card — synthesize a minimal
    // report_json shell carrying just site_analysis so the UI has
    // something to read. The other AI-only narrative fields stay
    // empty (the UI guards on truthy).
    const finalReportJson =
      aiResult ??
      (siteAnalysis ? { site_analysis: siteAnalysis } as unknown : null)

    await supabase.from("market_reports").update({
      status:                "completed",
      currency:              targetCurrency,
      recommended_price:     metrics.recommendedPrice,
      recommended_price_min: metrics.recommendedPriceMin,
      recommended_price_max: metrics.recommendedPriceMax,
      confidence_score:      metrics.confidenceScore,
      summary:               aiResult?.executive_summary ?? null,
      report_json:           finalReportJson as never,
      // Cast through unknown — Supabase's Json typing rejects nested
      // typed objects (SiteAnalysis), but the value IS json-serializable.
      metadata: {
        ...meta,
        engine: {
          fx_rate:           fx.rate,
          fx_source:         fx.source,
          weighted_ppm2:     metrics.weightedPricePerM2,
          median_ppm2:       metrics.medianPricePerM2,
          outliers_detected: metrics.outliersDetected,
        },
        site_analysis: siteAnalysis ?? null,
      } as unknown as never,
    }).eq("id", id)

    await logEvent(id, "report_completed", "Report completed.")
    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    await supabase.from("market_reports")
      .update({ status: "failed", error_message: msg })
      .eq("id", id)
    await logEvent(id, "report_failed", msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

// ── Helpers ──────────────────────────────────────────────────────
async function logEvent(
  reportId: string,
  type: string,
  message: string,
  metadata: Record<string, unknown> = {},
) {
  const supabase = await createClient()
  await supabase.from("market_report_events").insert({
    report_id:  reportId,
    event_type: type,
    message,
    // Cast through unknown — Supabase's Json typing rejects Record<string, unknown>
    // but the value is JSON-serializable in practice.
    metadata:   metadata as unknown as never,
  })
}

function toComparableInsert(reportId: string, c: NormalizedListing) {
  return {
    report_id:        reportId,
    source_name:      c.source_name ?? null,
    source_url:       c.source_url ?? null,
    listing_url:      c.listing_url ?? null,
    title:            c.title ?? null,
    operation_type:   c.operation_type ?? null,
    property_type:    c.property_type ?? null,
    price:            c.price ?? null,
    currency:         c.currency ?? null,
    maintenance_fee:  c.maintenance_fee ?? null,
    price_usd:        c.price_usd ?? null,
    price_crc:        c.price_crc ?? null,
    location_text:    c.location_text ?? null,
    province:         c.province ?? null,
    canton:           c.canton ?? null,
    district:         c.district ?? null,
    neighborhood:     c.neighborhood ?? null,
    latitude:         c.latitude ?? null,
    longitude:        c.longitude ?? null,
    bedrooms:         c.bedrooms ?? null,
    bathrooms:        c.bathrooms ?? null,
    parking_spaces:   c.parking_spaces ?? null,
    built_area_m2:    c.built_area_m2 ?? null,
    lot_area_m2:      c.lot_area_m2 ?? null,
    price_per_m2:     c.price_per_m2 ?? null,
    amenities:        c.amenities ?? null,
    description:      c.description ?? null,
    agent_or_company: c.agent_or_company ?? null,
    is_featured:      c.is_featured ?? false,
    similarity_score: c.similarity_score ?? null,
    confidence_score: c.confidence_score ?? null,
    is_outlier:       c.is_outlier ?? false,
    exclusion_reason: c.exclusion_reason ?? null,
    raw_text:         c.raw_text ?? null,
    extracted_data:   c.extracted_data ?? null,
  }
}
