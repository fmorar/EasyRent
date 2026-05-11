"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import type { ActionResult, PropertyShare } from "@/types"

interface ShareInput {
  property_id:      string
  shared_with:      string
  commission_type:  "percentage" | "fixed"
  commission_value?: number
}

export async function shareProperty(
  input: ShareInput
): Promise<ActionResult<PropertyShare>> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  const { data, error } = await supabase
    .from("property_shares")
    .insert({
      property_id:            input.property_id,
      shared_by:              profile.id,
      shared_with:            input.shared_with,
      public_contact_user_id: input.shared_with,
      commission_type:        input.commission_type,
      commission_value:       input.commission_value ?? null,
      status:                 "pending",
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath(`/properties/${input.property_id}`)
  return { success: true, data }
}

export async function revokeShare(shareId: string): Promise<ActionResult> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  // Soft-delete: set deleted_at. RLS ensures only property owner or admin can do this.
  const { error } = await supabase
    .from("property_shares")
    .update({
      deleted_at: new Date().toISOString(),
      status:     "revoked",
    })
    .eq("id", shareId)

  if (error) return { success: false, error: error.message }

  revalidatePath("/properties")
  return { success: true, data: undefined }
}

// Admin only: approve or reject a pending share
export async function reviewShare(
  shareId: string,
  decision: "approved" | "rejected",
  review_notes?: string
): Promise<ActionResult<PropertyShare>> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  if (profile.role !== "owner_admin") {
    return { success: false, error: "Only admins can approve or reject shares" }
  }

  const { data, error } = await supabase
    .from("property_shares")
    .update({
      status: decision,
      notes:  review_notes ?? null,
    })
    .eq("id", shareId)
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  // Marketplace visibility is updated by DB trigger automatically
  revalidatePath("/shares")
  revalidatePath("/properties")
  return { success: true, data }
}

// Lazy-loaded share data for the property share dialog (lists + dropdown options)
export async function getPropertyShareData(propertyId: string): Promise<ActionResult<{
  shares: (PropertyShare & { shared_with_profile: import("@/types").Profile })[]
  agents: import("@/types").Profile[]
}>> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  const [{ data: sharesData, error: sharesErr }, { data: agentsData, error: agentsErr }] = await Promise.all([
    supabase
      .from("property_shares")
      .select(`
        *,
        shared_with_profile:profiles!property_shares_shared_with_fkey(*)
      `)
      .eq("property_id", propertyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("*")
      .eq("status", "active")
      .is("deleted_at", null)
      .neq("id", profile.id)
      .order("full_name", { ascending: true }),
  ])

  if (sharesErr) return { success: false, error: sharesErr.message }
  if (agentsErr) return { success: false, error: agentsErr.message }

  return {
    success: true,
    data: {
      shares: (sharesData ?? []) as unknown as (PropertyShare & { shared_with_profile: import("@/types").Profile })[],
      agents: (agentsData ?? []) as import("@/types").Profile[],
    },
  }
}

// Load pending shares for the admin approval queue
export async function getPendingShares() {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  if (profile.role !== "owner_admin") {
    return { success: false, error: "Admin only" }
  }

  const { data, error } = await supabase
    .from("property_shares")
    .select(`
      *,
      property:properties(id, title, slug),
      shared_by_profile:profiles!property_shares_shared_by_fkey(id, full_name, avatar_url),
      shared_with_profile:profiles!property_shares_shared_with_fkey(id, full_name, avatar_url, role)
    `)
    .eq("status", "pending")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) return { success: false, error: error.message }

  return { success: true, data }
}
