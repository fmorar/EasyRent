// ============================================================
// Listing quality checklist — evaluates the property record
// + photo count and emits the checklist + completeness pct.
//
// Each check has a weight (sum to 1.0). The completeness_pct
// score reflects how filled-out the listing is; signals like
// `missing_listing_information` use this number.
// ============================================================

import type { Property, PropertyPhoto } from "@/types"
import type { ListingQualityCheck, ListingQualityReport } from "./types"

interface Input {
  property:    Property
  photo_count: number
}

export function evaluateListingQuality({
  property, photo_count,
}: Input): ListingQualityReport {
  const checks: ListingQualityCheck[] = []

  // Photos — the single most important field. >= 5 photos is "complete".
  checks.push({
    key: "has_photos",
    status: photo_count >= 5 ? "complete" : photo_count >= 1 ? "partial" : "missing",
    weight: 0.20,
    recommendation: photo_count < 5
      ? `Subí al menos 5 fotos buenas (tenés ${photo_count})`
      : undefined,
  })

  // Description — at least 80 chars to count as complete
  const desc = (property.description ?? "").trim()
  checks.push({
    key: "has_description",
    status: desc.length >= 80 ? "complete" : desc.length > 0 ? "partial" : "missing",
    weight: 0.15,
    recommendation: desc.length < 80
      ? "Escribí una descripción más detallada (mínimo 80 caracteres)"
      : undefined,
  })

  // Price
  checks.push({
    key: "has_price",
    status: property.price && property.price > 0 ? "complete" : "missing",
    weight: 0.10,
  })

  // Maintenance fee — only relevant for sale listings
  if (property.listing_type === "sale") {
    const fee = (property as Property & { maintenance_fee?: number | null }).maintenance_fee
    checks.push({
      key: "has_maintenance_fee",
      status: fee != null ? "complete" : "missing",
      weight: 0.05,
      recommendation: fee == null
        ? "Agregá la cuota de mantenimiento si el condominio la tiene"
        : undefined,
    })
  }

  // Amenities
  const amenityCount = property.amenities?.length ?? 0
  checks.push({
    key: "has_amenities",
    status: amenityCount >= 3 ? "complete" : amenityCount > 0 ? "partial" : "missing",
    weight: 0.10,
    recommendation: amenityCount < 3
      ? "Listá al menos 3 amenidades"
      : undefined,
  })

  // Location info
  const hasCoords = property.display_lat != null && property.display_lng != null
  const hasAddr   = !!(property.display_address?.trim() || property.public_address?.trim())
  checks.push({
    key: "has_clear_location",
    status: hasCoords && hasAddr ? "complete" : hasCoords || hasAddr ? "partial" : "missing",
    weight: 0.10,
    recommendation: !hasCoords
      ? "Verificá que la ubicación esté en el mapa"
      : !hasAddr
      ? "Agregá una dirección pública (zona aproximada)"
      : undefined,
  })

  // Bedrooms / bathrooms / area / parking — all should be set
  for (const [key, val, w] of [
    ["has_bedrooms",  property.bedrooms,        0.05],
    ["has_bathrooms", property.bathrooms,       0.05],
    ["has_area",      property.area_sqm,        0.05],
    ["has_parking",   property.parking_spaces,  0.05],
  ] as const) {
    checks.push({
      key,
      status: val != null ? "complete" : "missing",
      weight: w,
    })
  }

  // Marketplace visibility — if false the listing isn't even public
  checks.push({
    key: "is_published",
    status: property.is_marketplace_visible ? "complete" : "missing",
    weight: 0.10,
    recommendation: property.is_marketplace_visible
      ? undefined
      : "La propiedad no está publicada en el marketplace todavía",
  })

  const completeness_pct = Math.round(
    checks.reduce((acc, c) => {
      const value = c.status === "complete" ? 1 : c.status === "partial" ? 0.5 : 0
      return acc + value * c.weight
    }, 0) * 100,
  )

  return { checks, completeness_pct }
}

// Convenience: count photos quickly. Caller passes the rows it
// already pulled for the photo carousel — we don't re-query.
export function countPhotosFromRows(rows: Pick<PropertyPhoto, "id">[] | null | undefined): number {
  return rows?.length ?? 0
}
