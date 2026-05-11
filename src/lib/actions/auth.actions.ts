"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import type { ActionResult, Profile } from "@/types"

interface ProfileUpdateInput {
  full_name: string
  phone?:    string
  bio?:      string
  zones?:    string[]
}

export async function updateProfile(
  input: ProfileUpdateInput
): Promise<ActionResult<Profile>> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: input.full_name,
      phone:     input.phone || null,
      bio:       input.bio   || null,
      zones:     input.zones ?? [],
    })
    .eq("id", profile.id)
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath("/settings")
  revalidatePath(`/agents/${profile.slug}`)
  return { success: true, data }
}

/**
 * Persist a new `avatar_url` on the current user's profile. The
 * actual file upload happens client-side directly to Supabase
 * Storage (bucket `avatars`, RLS-scoped to the user's auth.uid());
 * this action just records the resulting public URL.
 */
export async function updateProfileAvatar(
  avatarUrl: string | null
): Promise<ActionResult<Profile>> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", profile.id)
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath("/settings")
  revalidatePath(`/agents/${profile.slug}`)
  return { success: true, data }
}

/**
 * Persist a new `cover_url` on the current user's profile. Same
 * upload flow as the avatar — direct browser upload to the
 * `avatars` bucket under `${userId}/cover.{ext}` (RLS-scoped to
 * the owner's folder), then this action records the public URL.
 */
export async function updateProfileCover(
  coverUrl: string | null
): Promise<ActionResult<Profile>> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  const { data, error } = await supabase
    .from("profiles")
    .update({ cover_url: coverUrl })
    .eq("id", profile.id)
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath("/settings")
  revalidatePath(`/agents/${profile.slug}`)
  return { success: true, data }
}

export async function signOut(): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()

  if (error) return { success: false, error: error.message }

  return { success: true, data: undefined }
}
