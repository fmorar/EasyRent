import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { slugify } from "@/lib/utils"
import type { Database } from "@/types/supabase"

type ExternalListing = Database["public"]["Tables"]["external_listings"]["Row"]
type PropertyInsert  = Database["public"]["Tables"]["properties"]["Insert"]

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Promote a consented external_listing into a real `properties` row,
 * publish it to the marketplace, and link everything together.
 *
 * Called from the owner agent's `accept_listing` tool when the owner
 * gives explicit consent. No human in the loop.
 *
 * What we DON'T do here (deliberately, for v1):
 *   • Photos — the scrape doesn't pull image URLs into our storage.
 *     The listing publishes without photos; an admin uploads them
 *     when they meet the owner. Marketplace card just shows the
 *     "no photo" placeholder until then.
 *   • English translation — the existing translation pipeline only
 *     fires on property mutations through certain server actions.
 *     We skip the auto-translate trigger; the listing shows in
 *     Spanish on both /es and /en until someone touches it. (TODO:
 *     wire to translateProperty when we move that helper out of the
 *     dashboard's property-edit flow.)
 *   • Owner profile creation — the owner doesn't have a profile in
 *     our system. We tag created_by to the first super_admin so the
 *     FK is non-null; the new property is system-owned, not
 *     owner-owned, until the owner formally signs up.
 *
 * Idempotent: if the external_listing already has a claimed_property_id,
 * return that property id and don't re-publish.
 */
export async function autoClaimListing(args: {
  externalListingId: string
  searchRequestId:   string
  outreachAttemptId: string
}): Promise<{ propertyId: string; created: boolean } | null> {
  const admin = createAdminClient()

  const listingRes = await admin
    .from("external_listings")
    .select("*")
    .eq("id", args.externalListingId)
    .single()
  if (listingRes.error || !listingRes.data) {
    console.warn("[auto-claim] external_listing not found", args.externalListingId)
    return null
  }
  const listing = listingRes.data as ExternalListing

  // Idempotency — already claimed.
  if (listing.is_claimed && listing.claimed_property_id) {
    return { propertyId: listing.claimed_property_id, created: false }
  }

  // We need: title, listing_type, property_type, price, currency.
  // Anything missing → bail; the owner agent can decide to ask for
  // it next turn, OR we leave it pending and an admin completes
  // manually. For now we bail loudly so the dashboard sees the gap.
  if (!listing.title || !listing.listing_type || !listing.property_type || listing.price == null) {
    console.warn(
      `[auto-claim] listing ${args.externalListingId} missing required fields`,
      { has_title: !!listing.title, has_listing_type: !!listing.listing_type, has_property_type: !!listing.property_type, has_price: listing.price != null },
    )
    return null
  }

  const createdBy = await getSystemCreatorId(admin)
  if (!createdBy) {
    console.error("[auto-claim] no super_admin available to attribute the property to")
    return null
  }

  const slug = await uniqueSlugFromTitle(admin, listing.title)
  const insert: PropertyInsert = {
    created_by:             createdBy,
    title:                  listing.title,
    slug,
    description:            listing.description ?? null,
    price:                  listing.price,
    currency:               (listing.currency as PropertyInsert["currency"]) ?? "USD",
    property_type:          listing.property_type as PropertyInsert["property_type"],
    listing_type:           (listing.listing_type as PropertyInsert["listing_type"]) ?? "rent",
    status:                 "available",
    bedrooms:               listing.bedrooms  ?? null,
    bathrooms:              listing.bathrooms ?? null,
    area_sqm:               listing.area_sqm  ?? null,
    display_address:        listing.location_text ?? null,
    location_mode:          "approximate",
    is_furnished:           listing.is_furnished ?? false,
    is_marketplace_visible: true,
  }

  const propRes = await admin
    .from("properties")
    .insert(insert)
    .select("id")
    .single()
  if (propRes.error || !propRes.data) {
    console.error("[auto-claim] insert property failed", propRes.error?.message)
    return null
  }
  const propertyId = propRes.data.id

  // Link back the claim + retire the external row from the agent's
  // search surface.
  await admin
    .from("external_listings")
    .update({
      is_claimed:          true,
      claimed_property_id: propertyId,
      claimed_at:          new Date().toISOString(),
    })
    .eq("id", args.externalListingId)

  await admin
    .from("owner_outreach_attempts")
    .update({
      status:              "accepted",
      accepted_at:         new Date().toISOString(),
      claimed_property_id: propertyId,
    })
    .eq("id", args.outreachAttemptId)

  await admin
    .from("search_requests")
    .update({
      status:                        "fulfilled",
      fulfilled_property_id:         propertyId,
      fulfilled_external_listing_id: args.externalListingId,
      fulfilled_at:                  new Date().toISOString(),
    })
    .eq("id", args.searchRequestId)

  console.log(
    `[auto-claim] published external=${args.externalListingId} as property=${propertyId} for search=${args.searchRequestId}`,
  )
  return { propertyId, created: true }
}

/**
 * Find a system user to attribute auto-claimed listings to. We pick
 * the FIRST super_admin (oldest by created_at) so the assignment is
 * deterministic and stable across deployments. If there are no
 * super_admins yet, the helper returns null and auto-claim aborts —
 * setup gate, not a code bug.
 */
async function getSystemCreatorId(admin: AdminClient): Promise<string | null> {
  const res = await admin
    .from("profiles")
    .select("id")
    .eq("role", "super_admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  return res.data?.id ?? null
}

/**
 * Make a slug unique by appending a short suffix when a collision is
 * found. We pick from a base36 alphabet so the URL stays compact —
 * "casa-en-pavas-x7y2" is fine; anything longer is ugly.
 */
async function uniqueSlugFromTitle(admin: AdminClient, title: string): Promise<string> {
  const base = slugify(title).slice(0, 60) || "propiedad"
  // First try the raw slug.
  const existing = await admin.from("properties").select("id").eq("slug", base).maybeSingle()
  if (!existing.data) return base
  // Collision — append a short suffix until we find a free one.
  for (let i = 0; i < 5; i++) {
    const suffix = Math.random().toString(36).slice(2, 6)
    const candidate = `${base}-${suffix}`
    const r = await admin.from("properties").select("id").eq("slug", candidate).maybeSingle()
    if (!r.data) return candidate
  }
  // Last-resort timestamp suffix.
  return `${base}-${Date.now().toString(36).slice(-6)}`
}
