"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import {
  translateProperty,
  computeSourceHash,
  type TranslationOutput,
} from "@/lib/translations/property-translation"
import type { ActionResult } from "@/types"

// ── Types ────────────────────────────────────────────────────

export type PropertyTranslation = {
  id:              string
  property_id:     string
  locale:          string
  title:           string | null
  description:     string | null
  public_address:  string | null
  seo_title:       string | null
  seo_description: string | null
  highlights:      string[] | null
  translated_by:   string
  status:          "pending" | "auto_translated" | "needs_review" | "reviewed"
  source_hash:     string | null
  reviewed_at:     string | null
  reviewed_by:     string | null
  created_at:      string
  updated_at:      string
}

// ── Generate ─────────────────────────────────────────────────

export async function generatePropertyTranslation(
  propertyId: string,
  targetLocale: string
): Promise<ActionResult<PropertyTranslation>> {
  await requireAdmin()
  const supabase = await createClient()

  const { data: property, error: fetchErr } = await supabase
    .from("properties")
    .select("id, title, description, public_address, slug")
    .eq("id", propertyId)
    .single()

  if (fetchErr || !property) {
    return { success: false, error: "Property not found" }
  }

  let output: TranslationOutput
  try {
    output = await translateProperty(property, targetLocale)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Translation failed"
    return { success: false, error: message }
  }

  const sourceHash = computeSourceHash(property)

  const { data, error } = await supabase
    .from("property_translations")
    .upsert(
      {
        property_id:     propertyId,
        locale:          targetLocale,
        title:           output.title,
        description:     output.description ?? null,
        public_address:  output.public_address ?? null,
        seo_title:       output.seo_title ?? null,
        seo_description: output.seo_description ?? null,
        highlights:      output.highlights ?? null,
        translated_by:   "ai",
        status:          "auto_translated",
        source_hash:     sourceHash,
        reviewed_at:     null,
        reviewed_by:     null,
      },
      { onConflict: "property_id,locale" }
    )
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath(`/properties/${propertyId}`)
  return { success: true, data: data as PropertyTranslation }
}

// ── Regenerate ────────────────────────────────────────────────

export async function regeneratePropertyTranslation(
  propertyId: string,
  targetLocale: string
): Promise<ActionResult<PropertyTranslation>> {
  // Regenerate is the same as generate (upsert overwrites)
  return generatePropertyTranslation(propertyId, targetLocale)
}

// ── Update (manual edit) ──────────────────────────────────────

export async function updatePropertyTranslation(
  propertyId: string,
  locale: string,
  fields: Partial<Pick<PropertyTranslation, "title" | "description" | "public_address" | "seo_title" | "seo_description" | "highlights">>
): Promise<ActionResult<PropertyTranslation>> {
  const { profile } = await requireAdmin()
  const supabase    = await createClient()

  const { data, error } = await supabase
    .from("property_translations")
    .update({
      ...fields,
      translated_by: "human",
      status:        "needs_review",
    })
    .eq("property_id", propertyId)
    .eq("locale", locale)
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath(`/properties/${propertyId}`)
  return { success: true, data: data as PropertyTranslation }
}

// ── Mark reviewed ─────────────────────────────────────────────

export async function markTranslationAsReviewed(
  propertyId: string,
  locale: string
): Promise<ActionResult<PropertyTranslation>> {
  const { userId } = await requireAdmin()
  const supabase   = await createClient()

  const { data, error } = await supabase
    .from("property_translations")
    .update({
      status:      "reviewed",
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId,
    })
    .eq("property_id", propertyId)
    .eq("locale", locale)
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath(`/properties/${propertyId}`)
  return { success: true, data: data as PropertyTranslation }
}

// ── Fetch ─────────────────────────────────────────────────────

export async function getPropertyTranslations(
  propertyId: string
): Promise<PropertyTranslation[]> {
  await requireAdmin()
  const supabase = await createClient()

  const { data } = await supabase
    .from("property_translations")
    .select("*")
    .eq("property_id", propertyId)
    .order("locale")

  return (data ?? []) as PropertyTranslation[]
}
