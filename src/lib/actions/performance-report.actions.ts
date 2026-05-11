"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { nanoid } from "nanoid"
import type {
  ActionResult, PropertyPerformanceReport, PropertyPerformanceReportInsert,
} from "@/types"

interface CreateReportInput {
  property_id:           string
  report_period_start?:  string | null   // ISO; null = "since publication"
  report_period_end?:    string | null
  visibility_settings?: Partial<{
    show_lead_list:       boolean
    show_traffic:         boolean
    show_timeline:        boolean
    show_recommendations: boolean
    lead_initials_only:   boolean
  }>
}

/**
 * Creates a draft performance report. The actual aggregation runs
 * via POST /api/performance-reports/[id]/run (long-running, nodejs).
 */
export async function createPerformanceReport(
  input: CreateReportInput,
): Promise<ActionResult<{ id: string }>> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  // Verify the property belongs to the user (or admin sees any)
  const { data: prop, error: propErr } = await supabase
    .from("properties")
    .select("id")
    .eq("id", input.property_id)
    .is("deleted_at", null)
    .single()

  if (propErr || !prop) {
    return { success: false, error: "Property not found" }
  }

  const insert: PropertyPerformanceReportInsert = {
    property_id:        input.property_id,
    created_by:         profile.id,
    status:             "draft",
    public_token:       nanoid(40),
    report_period_start: input.report_period_start ?? null,
    report_period_end:   input.report_period_end   ?? null,
    visibility_settings: {
      show_lead_list:       true,
      show_traffic:         true,
      show_timeline:        true,
      show_recommendations: true,
      lead_initials_only:   true,
      ...(input.visibility_settings ?? {}),
    } as never,
  }

  const { data, error } = await supabase
    .from("property_performance_reports")
    .insert(insert)
    .select("id")
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? "Could not create report" }
  }

  revalidatePath("/performance-reports")
  return { success: true, data: { id: data.id } }
}

export async function listPerformanceReports():
  Promise<ActionResult<PropertyPerformanceReport[]>>
{
  await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("property_performance_reports")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) return { success: false, error: error.message }
  return { success: true, data: (data ?? []) as PropertyPerformanceReport[] }
}

export async function deletePerformanceReport(id: string): Promise<ActionResult> {
  await requireAuth()
  const supabase = await createClient()

  // Best-effort PDF cleanup
  const { data: report } = await supabase
    .from("property_performance_reports")
    .select("pdf_path")
    .eq("id", id)
    .maybeSingle()

  if (report?.pdf_path) {
    await supabase.storage.from("performance-reports").remove([report.pdf_path])
  }

  const { error } = await supabase
    .from("property_performance_reports")
    .delete()
    .eq("id", id)

  if (error) return { success: false, error: error.message }
  revalidatePath("/performance-reports")
  return { success: true, data: undefined }
}

interface UpdateVisibilityInput {
  id: string
  visibility_settings: Partial<{
    show_lead_list:       boolean
    show_traffic:         boolean
    show_timeline:        boolean
    show_recommendations: boolean
    lead_initials_only:   boolean
  }>
}

export async function updatePerformanceReportVisibility(
  input: UpdateVisibilityInput,
): Promise<ActionResult> {
  await requireAuth()
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("property_performance_reports")
    .select("visibility_settings")
    .eq("id", input.id)
    .single()

  if (!existing) return { success: false, error: "Report not found" }

  const merged = {
    ...(existing.visibility_settings as Record<string, unknown>),
    ...input.visibility_settings,
  }

  const { error } = await supabase
    .from("property_performance_reports")
    .update({ visibility_settings: merged as never })
    .eq("id", input.id)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/performance-reports/${input.id}`)
  return { success: true, data: undefined }
}
