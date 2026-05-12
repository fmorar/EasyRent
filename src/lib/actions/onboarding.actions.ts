"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import type { ActionResult } from "@/types"

/**
 * Stamp the current user's profile as having seen the first-property
 * tour. Idempotent — once set the dashboard never auto-launches the
 * tour again. Called when the user finishes or skips the tour.
 */
export async function markTourCompleted(): Promise<ActionResult> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  // No-op if already stamped — saves a write.
  if (profile.tour_completed_at) return { success: true, data: undefined }

  const { error } = await supabase
    .from("profiles")
    .update({ tour_completed_at: new Date().toISOString() })
    .eq("id", profile.id)

  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}
