"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { isAdminRole } from "@/lib/roles"
import { revalidatePath } from "next/cache"
import { formatListingPrice } from "@/lib/utils"
import { formatCommission } from "@/lib/labels"
import { sendShareNotificationEmail } from "@/lib/email/send-share-notification"
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

  // Only the property's creator can share it with other agents.
  // Non-owners (including admins) cannot re-share — a recipient who
  // wants to pass the listing to a colleague has to ask the original
  // owner. This is the rule that keeps the commission accounting
  // honest: a share is a 50/50 split between owner and recipient, and
  // 3-way splits aren't supported yet.
  const { data: row } = await supabase
    .from("properties")
    .select("created_by")
    .eq("id", input.property_id)
    .is("deleted_at", null)
    .maybeSingle<{ created_by: string }>()

  if (!row) {
    return { success: false, error: "No se encontró la propiedad." }
  }
  if (row.created_by !== profile.id) {
    return {
      success: false,
      error:   "Solo el agente que subió la propiedad puede compartirla con otros agentes.",
    }
  }

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

  // Fire-and-forget email notification to the recipient. We pull the
  // bits the template needs in parallel; if any fetch fails we just
  // skip the email — the share row is the source of truth, the email
  // is a nudge. Wrapped so a Resend outage can't surface as a failed
  // share creation.
  void notifyRecipientOfShare({
    propertyId:  input.property_id,
    recipientId: input.shared_with,
    senderName:  profile.full_name,
    commissionType:  input.commission_type,
    commissionValue: input.commission_value ?? null,
  }).catch((err) => {
    console.error("[share] notify recipient failed:", err)
  })

  revalidatePath(`/properties/${input.property_id}`)
  return { success: true, data }
}

async function notifyRecipientOfShare(input: {
  propertyId:      string
  recipientId:     string
  senderName:      string | null
  commissionType:  "percentage" | "fixed"
  commissionValue: number | null
}): Promise<void> {
  const supabase = await createClient()

  const [{ data: recipient }, { data: property }, { data: cover }] = await Promise.all([
    supabase
      .from("profiles")
      .select("email")
      .eq("id", input.recipientId)
      .is("deleted_at", null)
      .maybeSingle<{ email: string | null }>(),
    supabase
      .from("properties")
      .select("title, listing_type, price, currency, display_address, bedrooms, bathrooms, area_sqm")
      .eq("id", input.propertyId)
      .is("deleted_at", null)
      .maybeSingle<{
        title:            string
        listing_type:     "sale" | "rent" | null
        price:            number | null
        currency:         string | null
        display_address:  string | null
        bedrooms:         number | null
        bathrooms:        number | null
        area_sqm:         number | null
      }>(),
    supabase
      .from("property_photos")
      .select("url")
      .eq("property_id", input.propertyId)
      .eq("is_cover", true)
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle<{ url: string }>(),
  ])

  if (!recipient?.email || !property) return

  // Fallback to first photo when no explicit cover is flagged.
  let coverUrl: string | null = cover?.url ?? null
  if (!coverUrl) {
    const { data: firstPhoto } = await supabase
      .from("property_photos")
      .select("url")
      .eq("property_id", input.propertyId)
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle<{ url: string }>()
    coverUrl = firstPhoto?.url ?? null
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.easyrent.house").replace(/\/$/, "")
  const reviewUrl = `${appUrl}/es/shares`

  const priceLabel = property.price != null
    ? formatListingPrice(Number(property.price), property.currency, property.listing_type)
    : "Precio a confirmar"
  const listingTypeLabel = property.listing_type === "rent" ? "En alquiler" : "En venta"

  await sendShareNotificationEmail({
    to:         recipient.email,
    senderName: input.senderName,
    property: {
      title:            property.title,
      listingTypeLabel,
      priceLabel,
      address:          property.display_address,
      bedrooms:         property.bedrooms,
      bathrooms:        property.bathrooms,
      areaSqm:          property.area_sqm,
      coverUrl,
    },
    commissionLabel: formatCommission(input.commissionType, input.commissionValue),
    reviewUrl,
  })
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

// Approve or reject a pending share. Only the recipient of the share
// (shared_with) can decide — the sender can't approve their own
// request, even if they happen to be an admin. super_admin keeps an
// override for support / audit scenarios.
export async function reviewShare(
  shareId: string,
  decision: "approved" | "rejected",
  review_notes?: string
): Promise<ActionResult<PropertyShare>> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  const { data: share, error: fetchErr } = await supabase
    .from("property_shares")
    .select("shared_by, shared_with")
    .eq("id", shareId)
    .is("deleted_at", null)
    .maybeSingle<{ shared_by: string; shared_with: string }>()

  if (fetchErr || !share) {
    return { success: false, error: "No se encontró la solicitud." }
  }
  if (share.shared_by === profile.id) {
    return { success: false, error: "No podés aprobar una solicitud que enviaste vos." }
  }
  if (share.shared_with !== profile.id && profile.role !== "super_admin") {
    return { success: false, error: "Solo el agente destinatario puede revisar esta solicitud." }
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

  if (!isAdminRole(profile.role)) {
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
