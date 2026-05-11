"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { nanoid } from "nanoid"
import {
  CreateMarketReportSchema,
  type CreateMarketReportInput,
} from "@/lib/market-analysis/schemas"
import { detectSource } from "@/lib/market-analysis/source-detector"
import type {
  ActionResult,
  MarketReport,
  MarketReportInsert,
} from "@/types"

// ── Create — draft only; the /run route triggers the pipeline ───
export async function createMarketReport(
  input: CreateMarketReportInput
): Promise<ActionResult<{ id: string }>> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  const parsed = CreateMarketReportSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const data = parsed.data

  // Verify the property belongs to (or is accessible by) the user.
  const { data: property, error: propErr } = await supabase
    .from("properties")
    .select("id, title, slug, listing_type")
    .eq("id", data.property_id)
    .is("deleted_at", null)
    .single()

  if (propErr || !property) {
    return { success: false, error: "Property not found" }
  }

  const insert: MarketReportInsert = {
    property_id:   data.property_id,
    created_by:    profile.id,
    report_type:   data.report_type,
    report_locale: data.report_locale,
    status:        "draft",
    title:         property.title,
    public_token:  nanoid(40),
    metadata: {
      source_urls:  data.source_urls,
      scan_depth:   data.scan_depth,
      max_listings: data.max_listings,
      filters:      data.filters,
    },
  }

  const { data: report, error: insErr } = await supabase
    .from("market_reports")
    .insert(insert)
    .select("id")
    .single()

  if (insErr || !report) {
    return { success: false, error: insErr?.message ?? "Could not create report" }
  }

  // Persist sources with detection metadata
  const sourcesPayload = data.source_urls.map((url) => {
    const det = detectSource(url)
    return {
      report_id:         report.id,
      source_url:        url,
      source_name:       det.source_name,
      source_type:       det.source_type === "unsupported" ? null : det.source_type,
      detected_category: det.detected_category ?? null,
      status:            det.source_type === "unsupported" ? "unsupported" as const : "pending" as const,
      metadata:          { is_broad: det.is_broad ?? false, warning: det.warning ?? null },
    }
  })

  await supabase.from("market_report_sources").insert(sourcesPayload)

  // Log creation event
  await supabase.from("market_report_events").insert({
    report_id:   report.id,
    event_type:  "report_created",
    message:     `Report created with ${data.source_urls.length} source(s).`,
    metadata:    { source_count: data.source_urls.length, scan_depth: data.scan_depth },
  })

  revalidatePath("/market-analysis")
  return { success: true, data: { id: report.id } }
}

// ── List ────────────────────────────────────────────────────────
export async function listMarketReports(): Promise<ActionResult<MarketReport[]>> {
  await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("market_reports")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) return { success: false, error: error.message }
  return { success: true, data: (data ?? []) as MarketReport[] }
}

// ── Delete ──────────────────────────────────────────────────────
export async function deleteMarketReport(
  id: string
): Promise<ActionResult> {
  await requireAuth()
  const supabase = await createClient()

  // RLS enforces ownership / admin. Best-effort cleanup of PDF in storage.
  const { data: report } = await supabase
    .from("market_reports")
    .select("pdf_path")
    .eq("id", id)
    .maybeSingle()

  if (report?.pdf_path) {
    await supabase.storage.from("market-reports").remove([report.pdf_path])
  }

  const { error } = await supabase
    .from("market_reports")
    .delete()
    .eq("id", id)

  if (error) return { success: false, error: error.message }

  revalidatePath("/market-analysis")
  return { success: true, data: undefined }
}

// ── Duplicate — copy config into a fresh draft ──────────────────
export async function duplicateMarketReport(
  id: string
): Promise<ActionResult<{ id: string }>> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  const { data: src, error } = await supabase
    .from("market_reports")
    .select("property_id, report_type, report_locale, title, metadata")
    .eq("id", id)
    .single()

  if (error || !src) return { success: false, error: "Source report not found" }

  const insert: MarketReportInsert = {
    property_id:   src.property_id,
    created_by:    profile.id,
    report_type:   src.report_type,
    report_locale: src.report_locale,
    status:        "draft",
    title:         src.title,
    public_token:  nanoid(40),
    metadata:      src.metadata ?? {},
  }

  const { data: dup, error: insErr } = await supabase
    .from("market_reports")
    .insert(insert)
    .select("id")
    .single()

  if (insErr || !dup) return { success: false, error: insErr?.message ?? "Could not duplicate" }

  // Re-create sources from the metadata.source_urls if present
  const meta = (src.metadata ?? {}) as Record<string, unknown>
  const urls = Array.isArray(meta.source_urls) ? (meta.source_urls as string[]) : []
  if (urls.length > 0) {
    const payload = urls.map((url) => {
      const det = detectSource(url)
      return {
        report_id:         dup.id,
        source_url:        url,
        source_name:       det.source_name,
        source_type:       det.source_type === "unsupported" ? null : det.source_type,
        detected_category: det.detected_category ?? null,
        status:            det.source_type === "unsupported" ? "unsupported" as const : "pending" as const,
        metadata:          { is_broad: det.is_broad ?? false, warning: det.warning ?? null },
      }
    })
    await supabase.from("market_report_sources").insert(payload)
  }

  revalidatePath("/market-analysis")
  return { success: true, data: { id: dup.id } }
}
