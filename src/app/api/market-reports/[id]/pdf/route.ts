// ============================================================
// GET /api/market-reports/[id]/pdf
//
// Two access modes:
//   • authenticated owner/admin → query without token, RLS gates
//   • public via owner-link    → ?token=<public_token>, RPC gates
//
// On first call we generate the PDF, upload to the
// `market-reports` bucket, persist `pdf_path`. Subsequent calls
// stream from storage (cached).
// ============================================================

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { renderMarketReportPdf } from "@/lib/market-analysis/pdf-service"
import { slugify } from "@/lib/utils"
import type { PublicReportData } from "@/components/public-report/public-market-report"

export const runtime     = "nodejs"
export const maxDuration = 60

interface Params { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  const url    = new URL(req.url)
  const token  = url.searchParams.get("token")
  const supabase = await createClient()

  // ── Resolve report data based on access mode ─────────────
  let publicData: PublicReportData | null = null
  let dbReportId: string | null = null

  if (token) {
    // Public mode — go through the SECURITY DEFINER RPC
    const { data, error } = await supabase.rpc("get_public_market_report", { p_token: token })
    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 })
    publicData = data as unknown as PublicReportData
    dbReportId = publicData.id
  } else {
    // Authenticated owner/admin — RLS does the gating
    const { data, error } = await supabase
      .from("market_reports")
      .select(`
        id, created_at, report_type, report_locale, currency,
        recommended_price, recommended_price_min, recommended_price_max,
        confidence_score, report_json, pdf_path, property_id
      `)
      .eq("id", id)
      .maybeSingle()
    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { data: prop } = await supabase
      .from("properties")
      .select(`
        title, slug, property_type, listing_type,
        bedrooms, bathrooms, parking_spaces, area_sqm,
        display_address, currency, price
      `)
      .eq("id", data.property_id)
      .maybeSingle()

    dbReportId = data.id
    publicData = {
      id:                    data.id,
      created_at:            data.created_at,
      report_type:           data.report_type,
      report_locale:         data.report_locale === "en" ? "en" : "es",
      currency:              data.currency,
      recommended_price:     data.recommended_price == null ? null : Number(data.recommended_price),
      recommended_price_min: data.recommended_price_min == null ? null : Number(data.recommended_price_min),
      recommended_price_max: data.recommended_price_max == null ? null : Number(data.recommended_price_max),
      confidence_score:      data.confidence_score == null ? null : Number(data.confidence_score),
      report_json:           data.report_json as PublicReportData["report_json"],
      pdf_path:              data.pdf_path,
      property:              prop ? {
        title:           prop.title,
        slug:            prop.slug,
        property_type:   prop.property_type,
        listing_type:    prop.listing_type,
        bedrooms:        prop.bedrooms,
        bathrooms:       prop.bathrooms,
        parking_spaces:  prop.parking_spaces,
        area_sqm:        prop.area_sqm == null ? null : Number(prop.area_sqm),
        display_address: prop.display_address,
        currency:        prop.currency,
        price:           prop.price == null ? null : Number(prop.price),
      } : null,
    }
  }

  if (!publicData || !dbReportId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // ── Generate PDF ─────────────────────────────────────────
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderMarketReportPdf(publicData)
  } catch (err) {
    return NextResponse.json({
      error: "PDF generation failed",
      detail: err instanceof Error ? err.message : "unknown",
    }, { status: 500 })
  }

  // ── Persist to storage + DB (best-effort) ────────────────
  const slug = publicData.property?.slug ?? "report"
  const date = new Date().toISOString().slice(0, 10)
  const path = `${dbReportId}/market-analysis-${slugify(slug)}-${date}.pdf`

  try {
    await supabase.storage
      .from("market-reports")
      .upload(path, pdfBuffer, {
        contentType: "application/pdf",
        upsert:      true,
      })

    if (!token) {
      // Only the owner mode is allowed to update by RLS — public mode
      // would need the service role key which we deliberately don't use here.
      await supabase.from("market_reports")
        .update({ pdf_path: path })
        .eq("id", dbReportId)
    }
  } catch { /* swallow — we can still return the buffer */ }

  // ── Stream the buffer back ───────────────────────────────
  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="market-analysis-${slugify(slug)}-${date}.pdf"`,
      "Cache-Control":       "private, max-age=300",
    },
  })
}
