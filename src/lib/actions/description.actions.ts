"use server"

import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { rewriteDescription, type DescriptionContext } from "@/lib/ai/rewrite-description"
import type { ActionResult } from "@/types"

export type AiRewriteInput = DescriptionContext & {
  /** When provided, server-side merges in the project's amenities + description. */
  project_id?: string | null
}

export async function aiRewriteDescription(
  ctx: AiRewriteInput,
): Promise<ActionResult<string>> {
  await requireAdmin()

  try {
    const enriched = await enrichWithProject(ctx)
    const html     = await rewriteDescription(enriched)
    return { success: true, data: html }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al generar descripción"
    return { success: false, error: message }
  }
}

// Pull in the project's amenities and (when the property has no description
// of its own) the project's description so the AI has full context.
async function enrichWithProject(ctx: AiRewriteInput): Promise<DescriptionContext> {
  if (!ctx.project_id) return ctx

  const supabase = await createClient()

  const [{ data: project }, { data: amenities }] = await Promise.all([
    supabase
      .from("projects")
      .select("title, description, location_label")
      .eq("id", ctx.project_id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("project_amenities")
      .select("name, sort_order")
      .eq("project_id", ctx.project_id)
      .order("sort_order", { ascending: true }),
  ])

  // Merge amenities: project first, then any property-specific ones not duplicated
  const projectAmenityNames = (amenities ?? []).map((a) => a.name)
  const lower = new Set(projectAmenityNames.map((n) => n.toLowerCase()))
  const extra = (ctx.amenities ?? []).filter(
    (a) => !lower.has(a.toLowerCase()),
  )
  const mergedAmenities = [...projectAmenityNames, ...extra]

  return {
    ...ctx,
    title:               ctx.title          ?? project?.title          ?? null,
    public_address:      ctx.public_address ?? project?.location_label ?? null,
    amenities:           mergedAmenities,
    // If the property has its own description, keep it. Otherwise let the
    // project's description seed the rewrite via current_description.
    current_description: ctx.current_description?.trim()
      ? ctx.current_description
      : project?.description ?? null,
  }
}
