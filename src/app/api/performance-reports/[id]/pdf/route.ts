// ============================================================
// GET /api/performance-reports/[id]/pdf
//
// Two access modes (mirror the market-analysis PDF route):
//   - authenticated owner/admin → no token, RLS gates
//   - public via token         → ?token=<public_token>, RPC gates
// ============================================================

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { renderOwnerReportPdf } from "@/lib/property-performance/pdf-service"
import { slugify } from "@/lib/utils"
import type { OwnerReportPayload } from "@/lib/property-performance/types"

export const runtime     = "nodejs"
export const maxDuration = 60

interface Params { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  const url    = new URL(req.url)
  const token  = url.searchParams.get("token")
  const supabase = await createClient()

  let payload: OwnerReportPayload | null = null
  let dbReportId: string | null = null
  let slug = "report"

  if (token) {
    // Public mode — go through the RPC
    const { data, error } = await supabase
      .rpc("get_public_property_performance_report", { p_token: token })
    if (error || !data) return NextResponse.json({ error: "not_found" }, { status: 404 })

    const d = data as { id: string; report_json: OwnerReportPayload | null; property?: { slug?: string } }
    if (!d.report_json) return NextResponse.json({ error: "not_ready" }, { status: 404 })
    payload    = d.report_json
    dbReportId = d.id
    slug       = d.property?.slug ?? slug
  } else {
    // Authenticated mode — RLS gates the SELECT
    const { data, error } = await supabase
      .from("property_performance_reports")
      .select("id, report_json, pdf_path, property_id")
      .eq("id", id)
      .maybeSingle()

    if (error || !data || !data.report_json) {
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }
    payload    = data.report_json as unknown as OwnerReportPayload
    dbReportId = data.id

    // Look up property slug for the filename
    const { data: prop } = await supabase
      .from("properties").select("slug").eq("id", data.property_id).maybeSingle()
    slug = prop?.slug ?? slug
  }

  if (!payload || !dbReportId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  // ── Generate PDF ─────────────────────────────────────────
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderOwnerReportPdf(payload)
  } catch (err) {
    return NextResponse.json({
      error:  "pdf_generation_failed",
      detail: err instanceof Error ? err.message : "unknown",
    }, { status: 500 })
  }

  // ── Persist to storage (best effort) ─────────────────────
  const date = new Date().toISOString().slice(0, 10)
  const path = `${dbReportId}/property-performance-${slugify(slug)}-${date}.pdf`
  try {
    await supabase.storage
      .from("performance-reports")
      .upload(path, pdfBuffer, { contentType: "application/pdf", upsert: true })
    if (!token) {
      await supabase.from("property_performance_reports")
        .update({ pdf_path: path })
        .eq("id", dbReportId)
    }
  } catch { /* swallow */ }

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="property-performance-${slugify(slug)}-${date}.pdf"`,
      "Cache-Control":       "private, max-age=300",
    },
  })
}
