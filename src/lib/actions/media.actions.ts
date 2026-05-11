"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import type { ActionResult } from "@/types"

export type VideoRow = {
  id: string
  property_id: string
  youtube_url: string
  title: string | null
  order_index: number
  created_at: string
}

// ── Photos ────────────────────────────────────────────────────

export async function deletePhoto(photoId: string): Promise<ActionResult> {
  await requireAdmin()
  const supabase = await createClient()

  // Fetch storage_path first
  const { data: photo, error: fetchErr } = await supabase
    .from("property_photos")
    .select("storage_path, property_id")
    .eq("id", photoId)
    .single()

  if (fetchErr || !photo) {
    return { success: false, error: "Photo not found" }
  }

  // Delete from storage if path exists
  if (photo.storage_path) {
    const { error: storageErr } = await supabase.storage
      .from("property-photos")
      .remove([photo.storage_path])
    if (storageErr) {
      return { success: false, error: storageErr.message }
    }
  }

  // Delete DB row
  const { error: dbErr } = await supabase
    .from("property_photos")
    .delete()
    .eq("id", photoId)

  if (dbErr) return { success: false, error: dbErr.message }

  revalidatePath(`/properties/${photo.property_id}`)
  return { success: true, data: undefined }
}

export async function updatePhotoOrder(
  propertyId: string,
  orderedIds: string[]
): Promise<ActionResult> {
  await requireAdmin()
  const supabase = await createClient()

  // Update each photo's order_index and is_cover
  const updates = orderedIds.map((id, index) =>
    supabase
      .from("property_photos")
      .update({ order_index: index, is_cover: index === 0 })
      .eq("id", id)
      .eq("property_id", propertyId)
  )

  const results = await Promise.all(updates)
  const failed = results.find((r) => r.error)
  if (failed?.error) return { success: false, error: failed.error.message }

  revalidatePath(`/properties/${propertyId}`)
  return { success: true, data: undefined }
}

export async function updatePhotoCaption(
  photoId: string,
  caption: string
): Promise<ActionResult> {
  await requireAdmin()
  const supabase = await createClient()

  const { data: photo, error: fetchErr } = await supabase
    .from("property_photos")
    .select("property_id")
    .eq("id", photoId)
    .single()

  if (fetchErr || !photo) return { success: false, error: "Photo not found" }

  const { error } = await supabase
    .from("property_photos")
    .update({ caption })
    .eq("id", photoId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/properties/${photo.property_id}`)
  return { success: true, data: undefined }
}

// ── Videos ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any }

export async function addVideo(
  propertyId: string,
  youtubeUrl: string,
  title?: string
): Promise<ActionResult<VideoRow>> {
  await requireAdmin()
  const supabase = (await createClient()) as unknown as AnyClient

  // Get current max order_index
  const { data: existing } = await supabase
    .from("property_videos")
    .select("order_index")
    .eq("property_id", propertyId)
    .order("order_index", { ascending: false })
    .limit(1) as { data: { order_index: number }[] | null }

  const nextIndex = existing && existing.length > 0 ? existing[0].order_index + 1 : 0

  const { data, error } = await supabase
    .from("property_videos")
    .insert({
      property_id: propertyId,
      youtube_url: youtubeUrl,
      title: title ?? null,
      order_index: nextIndex,
    })
    .select()
    .single() as { data: VideoRow | null; error: { message: string } | null }

  if (error) return { success: false, error: error.message }

  revalidatePath(`/properties/${propertyId}`)
  return { success: true, data: data as VideoRow }
}

export async function deleteVideo(videoId: string): Promise<ActionResult> {
  await requireAdmin()
  const supabase = (await createClient()) as unknown as AnyClient

  const { data: video, error: fetchErr } = await supabase
    .from("property_videos")
    .select("property_id")
    .eq("id", videoId)
    .single() as { data: { property_id: string } | null; error: { message: string } | null }

  if (fetchErr || !video) return { success: false, error: "Video not found" }

  const { error } = await supabase
    .from("property_videos")
    .delete()
    .eq("id", videoId) as { error: { message: string } | null }

  if (error) return { success: false, error: error.message }

  revalidatePath(`/properties/${video.property_id}`)
  return { success: true, data: undefined }
}

export async function updateVideoOrder(
  propertyId: string,
  orderedIds: string[]
): Promise<ActionResult> {
  await requireAdmin()
  const supabase = (await createClient()) as unknown as AnyClient

  const updates = orderedIds.map((id, index) =>
    supabase
      .from("property_videos")
      .update({ order_index: index })
      .eq("id", id)
      .eq("property_id", propertyId) as Promise<{ error: { message: string } | null }>
  )

  const results = await Promise.all(updates)
  const failed = results.find((r) => r.error)
  if (failed?.error) return { success: false, error: failed.error.message }

  revalidatePath(`/properties/${propertyId}`)
  return { success: true, data: undefined }
}
