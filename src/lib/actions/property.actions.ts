"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { slugify } from "@/lib/utils"
import { nanoid } from "nanoid"
import type { ActionResult, Property, PropertyInsert, PropertyUpdate } from "@/types"

// ─────────────────────────────────────────────────────────────────
// Approximate-mode coordinate fuzzing
// ─────────────────────────────────────────────────────────────────
//
// Privacy contract: when `location_mode === "approximate"`, the
// `display_lat / display_lng` columns (which the public marketplace
// view + anonymous link expose) MUST NOT equal the exact coords.
//
// Strategy: snap to a 0.01° grid (~1.1 km cells). Resulting point is
// a deterministic "neighborhood centroid" — same input always yields
// the same output, so the public listing is stable across refreshes,
// but the exact street is unrecoverable from the displayed value.
// The exact coords still live in `exact_lat / exact_lng` (private
// columns) for the agent's own internal use.
function snapCoord(v: number | null | undefined, precision = 2): number | null {
  if (v == null || !Number.isFinite(v)) return null
  const f = Math.pow(10, precision)
  return Math.round(v * f) / f
}

function applyLocationFuzz(input: {
  location_mode?: PropertyInsert["location_mode"] | null
  exact_lat?:   number | null
  exact_lng?:   number | null
  display_lat?: number | null
  display_lng?: number | null
}) {
  const mode = input.location_mode ?? "approximate"
  if (mode === "exact") {
    return {
      display_lat: input.exact_lat ?? input.display_lat ?? null,
      display_lng: input.exact_lng ?? input.display_lng ?? null,
    }
  }
  // approximate → snap to ~1km grid
  return {
    display_lat: snapCoord(input.exact_lat ?? input.display_lat),
    display_lng: snapCoord(input.exact_lng ?? input.display_lng),
  }
}

type PropertyFormInput = {
  title:         string
  description?:  string
  price:         number
  currency?:     string
  property_type: PropertyInsert["property_type"]
  listing_type?: PropertyInsert["listing_type"]
  is_furnished?: boolean
  status?:       PropertyInsert["status"]
  location_mode?:PropertyInsert["location_mode"]
  public_address?:string
  exact_address?: string
  exact_lat?:    number | null
  exact_lng?:    number | null
  display_lat?:  number | null
  display_lng?:  number | null
  bedrooms?:     number | null
  bathrooms?:    number | null
  area_sqm?:     number | null
  floor?:        number | null
  parking_spaces?:number | null
  project_id?:   string | null
  owner_id?:     string | null
  amenities?:    string[]
}

export async function createProperty(
  input: PropertyFormInput
): Promise<ActionResult<Property>> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  // Generate a unique slug from title
  const baseSlug = slugify(input.title)
  const slug     = `${baseSlug}-${nanoid(6)}`

  const { data, error } = await supabase
    .from("properties")
    .insert({
      created_by:     profile.id,
      title:          input.title,
      description:    input.description ?? null,
      price:          input.price,
      currency:       input.currency ?? "USD",
      property_type:  input.property_type,
      listing_type:   input.listing_type ?? "sale",
      is_furnished:   input.is_furnished ?? false,
      status:         input.status ?? "available",
      location_mode:  input.location_mode ?? "approximate",
      public_address: input.public_address ?? null,
      // `display_address` is what the marketplace view exposes — keep it
      // mirrored with `public_address` so the public listing always
      // reflects what the agent set in the form.
      display_address: input.public_address ?? null,
      exact_address:  input.exact_address ?? null,
      exact_lat:      input.exact_lat   ?? null,
      exact_lng:      input.exact_lng   ?? null,
      // Public coords — derived from exact + fuzzed when approximate.
      ...applyLocationFuzz(input),
      bedrooms:       input.bedrooms ?? null,
      bathrooms:      input.bathrooms ?? null,
      area_sqm:       input.area_sqm ?? null,
      floor:          input.floor ?? null,
      parking_spaces: input.parking_spaces ?? null,
      project_id:     input.project_id ?? null,
      owner_id:       input.owner_id ?? null,
      amenities:      input.amenities ?? [],
      slug,
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  // Dashboard list + the new property's public listings (if visible)
  revalidatePath("/[locale]/(dashboard)/properties",            "page")
  revalidatePath("/[locale]/(public)/marketplace",              "page")
  revalidatePath("/[locale]/(public)/p/[slug]",                 "page")
  return { success: true, data }
}

export async function updateProperty(
  id:    string,
  input: Partial<PropertyFormInput>
): Promise<ActionResult<Property>> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  // Draft graduation: properties created via /properties/new get a
  // placeholder slug `draft-<nanoid>`. The dashboard card keys off
  // that prefix to render the "Borrador" pill. On the first save with
  // a real title we regenerate the slug so the listing leaves draft
  // state. Subsequent edits keep the existing slug to preserve any
  // share links already in circulation.
  let newSlug: string | undefined
  if (input.title) {
    const { data: current } = await supabase
      .from("properties")
      .select("slug")
      .eq("id", id)
      .single<{ slug: string | null }>()
    if (current?.slug?.startsWith("draft-")) {
      newSlug = `${slugify(input.title)}-${nanoid(6)}`
    }
  }

  const update: PropertyUpdate = {
    ...(newSlug ? { slug: newSlug } : {}),
    title:          input.title,
    description:    input.description,
    price:          input.price,
    currency:       input.currency,
    property_type:  input.property_type,
    listing_type:   input.listing_type,
    is_furnished:   input.is_furnished,
    status:         input.status,
    location_mode:   input.location_mode,
    public_address:  input.public_address,
    // Keep `display_address` mirrored with `public_address` — the
    // marketplace view reads `display_address`. Only update when the
    // form actually sent a `public_address` (i.e. address field touched).
    display_address: input.public_address !== undefined
      ? input.public_address
      : undefined,
    exact_address:   input.exact_address,
    exact_lat:       input.exact_lat,
    exact_lng:       input.exact_lng,
    // Public coords — fuzzed when location_mode = approximate, mirror
    // exact when location_mode = exact. Skip when no coords were sent
    // so we don't clobber existing values on partial updates.
    ...(input.exact_lat !== undefined || input.exact_lng !== undefined ||
        input.display_lat !== undefined || input.display_lng !== undefined
        ? applyLocationFuzz(input)
        : {}),
    bedrooms:        input.bedrooms,
    bathrooms:      input.bathrooms,
    area_sqm:       input.area_sqm,
    floor:          input.floor,
    parking_spaces: input.parking_spaces,
    project_id:     input.project_id,
    owner_id:       input.owner_id,
    amenities:      input.amenities,
  }

  // RLS policy ensures only owner or admin can update
  const { data, error } = await supabase
    .from("properties")
    .update(update)
    .eq("id", id)
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  // Invalidate every surface that could show this property — both
  // the dashboard pages AND the public marketplace + listing routes.
  // `revalidatePath` with the second arg "page" handles dynamic
  // segments correctly for App Router.
  revalidatePath("/[locale]/(dashboard)/properties",                "page")
  revalidatePath("/[locale]/(dashboard)/properties/[id]",           "page")
  revalidatePath("/[locale]/(public)/marketplace",                  "page")
  revalidatePath("/[locale]/(public)/p/[slug]",                     "page")
  revalidatePath("/[locale]/(unbranded)/p/a/[anonymousSlug]",       "page")
  // Also nudge the agent's profile page since their property list is there
  revalidatePath("/[locale]/(public)/agents/[slug]",                "page")
  return { success: true, data }
}

export async function deleteProperty(id: string): Promise<ActionResult> {
  await requireAuth()
  const supabase = await createClient()

  // Soft delete
  const { error } = await supabase
    .from("properties")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)

  if (error) return { success: false, error: error.message }

  revalidatePath("/properties")
  return { success: true, data: undefined }
}

export async function generateAnonymousSlug(
  propertyId: string
): Promise<ActionResult<{ anonymous_slug: string }>> {
  await requireAuth()
  const supabase = await createClient()

  const anonymous_slug = nanoid(12)

  const { error } = await supabase
    .from("properties")
    .update({ anonymous_slug })
    .eq("id", propertyId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/properties/${propertyId}`)
  return { success: true, data: { anonymous_slug } }
}

// ─────────────────────────────────────────────────────────────────
// Marketplace visibility toggle
//
// `is_marketplace_visible` is the single flag that gates whether the
// property appears in the public marketplace and the public detail
// page (`/p/[slug]`). The form intentionally doesn't expose it — it
// lives in the share dialog where the agent makes the explicit
// "publish" decision after reviewing the listing.
// ─────────────────────────────────────────────────────────────────
export async function setPropertyMarketplaceVisible(
  propertyId: string,
  visible:    boolean,
): Promise<ActionResult<{ is_marketplace_visible: boolean }>> {
  await requireAuth()
  const supabase = await createClient()

  const { error } = await supabase
    .from("properties")
    .update({ is_marketplace_visible: visible })
    .eq("id", propertyId)

  if (error) return { success: false, error: error.message }

  // Refresh the dashboard list AND any public surface that depends
  // on visibility (marketplace + public detail page).
  revalidatePath("/[locale]/(dashboard)/properties",  "page")
  revalidatePath("/[locale]/(public)/marketplace",    "page")
  revalidatePath(`/[locale]/(public)/p/[slug]`,       "page")

  return { success: true, data: { is_marketplace_visible: visible } }
}

// ─────────────────────────────────────────────────────────────────
// Draft creation — used by /properties/new to land the user directly
// in the full edit experience (form + photos + EN tab + preview)
// without a separate two-step flow.
//
// Placeholder values satisfy the NOT NULL constraints on `title` and
// `price`. The slug is `draft-<nanoid>` so it never collides and
// remains opaque if accidentally exposed (`is_marketplace_visible`
// defaults to false anyway).
// ─────────────────────────────────────────────────────────────────
export async function createDraftProperty(): Promise<ActionResult<{ id: string }>> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  const slug = `draft-${nanoid(10)}`

  const { data, error } = await supabase
    .from("properties")
    .insert({
      created_by:             profile.id,
      title:                  "Nueva propiedad",
      slug,
      price:                  1,                  // placeholder — required NOT NULL
      currency:               "USD",
      property_type:          "apartment",
      listing_type:           "sale",
      status:                 "available",
      location_mode:          "approximate",
      is_marketplace_visible: false,
      amenities:              [],
    } satisfies PropertyInsert)
    .select("id")
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? "No se pudo crear el borrador" }
  }

  // NOTE: no `revalidatePath` here. This action runs during the
  // /properties/new server-rendered page, and Next 16 disallows
  // revalidating during render. The user is redirected to the edit
  // page anyway; the dashboard list refreshes on next visit.
  return { success: true, data: { id: data.id } }
}

export async function revokeAnonymousSlug(
  propertyId: string
): Promise<ActionResult> {
  await requireAuth()
  const supabase = await createClient()

  const { error } = await supabase
    .from("properties")
    .update({ anonymous_slug: null })
    .eq("id", propertyId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/properties/${propertyId}`)
  return { success: true, data: undefined }
}
