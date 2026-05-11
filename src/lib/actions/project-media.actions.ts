"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import type { ActionResult } from "@/types"

// ── Types ─────────────────────────────────────────────────────────
export type ProjectAmenityRow = {
  id:         string
  name:       string
  icon:       string | null
  sort_order: number
}

export type ProjectPhotoRow = {
  id:           string
  project_id:   string
  url:          string
  storage_path: string | null
  type:         "hero" | "gallery" | "amenity"
  is_cover:     boolean
  order_index:  number
  caption:      string | null
}

// ──────────────────────────────────────────────────────────────────
// AMENITIES
// ──────────────────────────────────────────────────────────────────

export async function listProjectAmenities(
  projectId: string,
): Promise<ActionResult<ProjectAmenityRow[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("project_amenities")
    .select("id, name, icon, sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })

  if (error) return { success: false, error: error.message }
  return { success: true, data: (data ?? []) as ProjectAmenityRow[] }
}

/**
 * Replace the amenities for a project with the given list of names.
 * Simple semantics: clears existing rows and inserts the new set in order.
 */
export async function setProjectAmenities(
  projectId: string,
  names:     string[],
): Promise<ActionResult<ProjectAmenityRow[]>> {
  await requireAuth()
  const supabase = await createClient()

  // Dedupe + trim while preserving order
  const seen = new Set<string>()
  const normalized = names
    .map((n) => n.trim())
    .filter((n) => {
      const k = n.toLowerCase()
      if (!n || seen.has(k)) return false
      seen.add(k)
      return true
    })

  // Delete current rows (cascades to nothing — amenities are leaf data)
  const { error: delErr } = await supabase
    .from("project_amenities")
    .delete()
    .eq("project_id", projectId)
  if (delErr) return { success: false, error: delErr.message }

  if (normalized.length === 0) {
    revalidatePath(`/projects`)
    return { success: true, data: [] }
  }

  const rows = normalized.map((name, i) => ({
    project_id: projectId,
    name,
    sort_order: i,
  }))

  const { data, error } = await supabase
    .from("project_amenities")
    .insert(rows)
    .select("id, name, icon, sort_order")
    .order("sort_order", { ascending: true })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/projects`)
  return { success: true, data: (data ?? []) as ProjectAmenityRow[] }
}

// ──────────────────────────────────────────────────────────────────
// PHOTOS
// ──────────────────────────────────────────────────────────────────

export async function listProjectPhotos(
  projectId: string,
): Promise<ActionResult<ProjectPhotoRow[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("project_photos")
    .select("id, project_id, url, storage_path, type, is_cover, order_index, caption")
    .eq("project_id", projectId)
    .order("order_index", { ascending: true })

  if (error) return { success: false, error: error.message }
  return { success: true, data: (data ?? []) as ProjectPhotoRow[] }
}

export async function deleteProjectPhoto(
  photoId: string,
): Promise<ActionResult> {
  await requireAuth()
  const supabase = await createClient()

  // Read storage_path first so we can clean up the bucket
  const { data: photo } = await supabase
    .from("project_photos")
    .select("storage_path, project_id")
    .eq("id", photoId)
    .single()

  const { error } = await supabase
    .from("project_photos")
    .delete()
    .eq("id", photoId)

  if (error) return { success: false, error: error.message }

  if (photo?.storage_path) {
    await supabase.storage.from("project-photos").remove([photo.storage_path])
  }

  if (photo?.project_id) revalidatePath(`/projects`)
  return { success: true, data: undefined }
}

export async function updateProjectPhotoOrder(
  projectId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  await requireAuth()
  const supabase = await createClient()

  // Update each row's order_index + is_cover (first one is cover)
  const updates = orderedIds.map((id, i) =>
    supabase
      .from("project_photos")
      .update({ order_index: i, is_cover: i === 0 })
      .eq("id", id)
      .eq("project_id", projectId),
  )

  const results = await Promise.all(updates)
  const firstError = results.find((r) => r.error)
  if (firstError?.error) return { success: false, error: firstError.error.message }

  revalidatePath(`/projects`)
  return { success: true, data: undefined }
}

export async function updateProjectPhotoCaption(
  photoId: string,
  caption: string,
): Promise<ActionResult> {
  await requireAuth()
  const supabase = await createClient()

  const { error } = await supabase
    .from("project_photos")
    .update({ caption: caption.trim() || null })
    .eq("id", photoId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}

// ──────────────────────────────────────────────────────────────────
// FAQs
// ──────────────────────────────────────────────────────────────────

export type ProjectFaqRow = {
  id:         string
  project_id: string
  question:   string
  answer:     string
  sort_order: number
}

export async function listProjectFaqs(
  projectId: string,
): Promise<ActionResult<ProjectFaqRow[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("project_faqs")
    .select("id, project_id, question, answer, sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })

  if (error) return { success: false, error: error.message }
  return { success: true, data: (data ?? []) as ProjectFaqRow[] }
}

// ──────────────────────────────────────────────────────────────────
// LINKED PROPERTIES — agents can attach their own properties to a project
// ──────────────────────────────────────────────────────────────────

export type ProjectLinkedPropertyRow = {
  id:              string
  slug:            string
  title:           string
  display_address: string | null
  status:          "available" | "reserved" | "sold" | "off_market"
  price:           number | null
  currency:        string | null
  bedrooms:        number | null
  bathrooms:       number | null
  area_sqm:        number | null
  cover_url:       string | null
}

async function attachCovers(
  rows: Array<{ id: string }>,
): Promise<Record<string, string>> {
  if (rows.length === 0) return {}
  const supabase = await createClient()
  const { data: photos } = await supabase
    .from("property_photos")
    .select("property_id, url, is_cover, order_index")
    .in("property_id", rows.map((r) => r.id))
    .order("order_index", { ascending: true })

  const cover: Record<string, string> = {}
  ;(photos ?? []).forEach((p) => {
    const pid = (p as { property_id: string }).property_id
    if (cover[pid]) return            // already have first photo
    if (!(p as { is_cover: boolean }).is_cover && cover[pid]) return
    cover[pid] = (p as { url: string }).url
  })
  return cover
}

/** Properties currently linked to the project. */
export async function listProjectProperties(
  projectId: string,
): Promise<ActionResult<ProjectLinkedPropertyRow[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("properties")
    .select("id, slug, title, display_address, status, price, currency, bedrooms, bathrooms, area_sqm")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) return { success: false, error: error.message }
  const rows = (data ?? []) as Omit<ProjectLinkedPropertyRow, "cover_url">[]

  const covers = await attachCovers(rows)
  return {
    success: true,
    data: rows.map((r) => ({ ...r, cover_url: covers[r.id] ?? null })),
  }
}

/**
 * Properties the current user owns that are NOT yet linked to this project.
 * Filtered by an optional title query for the picker UI.
 */
export async function searchOwnPropertiesForProject(
  projectId: string,
  query?:    string,
): Promise<ActionResult<ProjectLinkedPropertyRow[]>> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  let q = supabase
    .from("properties")
    .select("id, slug, title, display_address, status, price, currency, bedrooms, bathrooms, area_sqm")
    .eq("created_by", profile.id)
    .is("deleted_at", null)
    .or(`project_id.is.null,project_id.neq.${projectId}`)

  if (query?.trim()) {
    q = q.ilike("title", `%${query.trim()}%`)
  }
  q = q.order("created_at", { ascending: false }).limit(20)

  const { data, error } = await q
  if (error) return { success: false, error: error.message }

  const rows = (data ?? []) as Omit<ProjectLinkedPropertyRow, "cover_url">[]
  const covers = await attachCovers(rows)
  return {
    success: true,
    data: rows.map((r) => ({ ...r, cover_url: covers[r.id] ?? null })),
  }
}

/** Link a property to the project (the property's project_id is set). */
export async function linkPropertyToProject(
  projectId:  string,
  propertyId: string,
): Promise<ActionResult> {
  await requireAuth()
  const supabase = await createClient()

  // RLS ensures only the property owner (or admin) can update it
  const { error } = await supabase
    .from("properties")
    .update({ project_id: projectId })
    .eq("id", propertyId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/properties/${propertyId}`)
  return { success: true, data: undefined }
}

export async function unlinkPropertyFromProject(
  propertyId: string,
): Promise<ActionResult> {
  await requireAuth()
  const supabase = await createClient()

  const { error } = await supabase
    .from("properties")
    .update({ project_id: null })
    .eq("id", propertyId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/properties/${propertyId}`)
  return { success: true, data: undefined }
}

/**
 * Replace the FAQ list for a project. Pass the new ordered set; existing rows
 * are deleted and the new set is inserted with sort_order = index.
 */
export async function setProjectFaqs(
  projectId: string,
  items:     { question: string; answer: string }[],
): Promise<ActionResult<ProjectFaqRow[]>> {
  await requireAuth()
  const supabase = await createClient()

  const cleaned = items
    .map((it) => ({ question: it.question.trim(), answer: it.answer.trim() }))
    .filter((it) => it.question.length > 0 && it.answer.length > 0)

  // Wipe existing rows
  const { error: delErr } = await supabase
    .from("project_faqs")
    .delete()
    .eq("project_id", projectId)
  if (delErr) return { success: false, error: delErr.message }

  if (cleaned.length === 0) return { success: true, data: [] }

  const rows = cleaned.map((it, i) => ({
    project_id: projectId,
    question:   it.question,
    answer:     it.answer,
    sort_order: i,
  }))

  const { data, error } = await supabase
    .from("project_faqs")
    .insert(rows)
    .select("id, project_id, question, answer, sort_order")
    .order("sort_order", { ascending: true })

  if (error) return { success: false, error: error.message }
  return { success: true, data: (data ?? []) as ProjectFaqRow[] }
}
