// ============================================================
// Comparable filter
//
// Drops obvious garbage and tags exclusion reasons. Outlier
// detection happens in pricing-engine.ts because it requires
// the whole population to compute IQR.
// ============================================================

import type { MarketFilterConfig, NormalizedListing, SubjectProperty } from "./types"

export interface FilterResult {
  kept:     NormalizedListing[]
  excluded: NormalizedListing[]
}

export function filterComparables(
  subject: SubjectProperty,
  comparables: NormalizedListing[],
  filters: MarketFilterConfig,
): FilterResult {
  const kept: NormalizedListing[] = []
  const excluded: NormalizedListing[] = []

  // Dedup by listing_url — keep first
  const seen = new Set<string>()

  for (const raw of comparables) {
    const c = { ...raw }   // don't mutate input

    if (c.listing_url) {
      if (seen.has(c.listing_url)) {
        c.exclusion_reason = "duplicate"
        excluded.push(c)
        continue
      }
      seen.add(c.listing_url)
    }

    // Hard filter: missing price
    if (filters.excludeWithoutPrice && (c.price == null || c.price <= 0)) {
      c.exclusion_reason = "missing_price"
      excluded.push(c)
      continue
    }
    // Hard filter: missing area
    if (filters.excludeWithoutArea && (c.built_area_m2 == null || c.built_area_m2 <= 0)) {
      c.exclusion_reason = "missing_area"
      excluded.push(c)
      continue
    }

    if (filters.matchOperationType && subject.listing_type && c.operation_type
        && c.operation_type !== subject.listing_type) {
      c.exclusion_reason = "operation_type_mismatch"
      excluded.push(c)
      continue
    }
    if (filters.matchPropertyType && subject.property_type && c.property_type
        && !propertyTypeMatches(subject.property_type, c.property_type)) {
      c.exclusion_reason = "property_type_mismatch"
      excluded.push(c)
      continue
    }

    // Optional advanced bounds
    if (filters.minArea != null && c.built_area_m2 != null && c.built_area_m2 < filters.minArea) {
      c.exclusion_reason = "below_min_area"; excluded.push(c); continue
    }
    if (filters.maxArea != null && c.built_area_m2 != null && c.built_area_m2 > filters.maxArea) {
      c.exclusion_reason = "above_max_area"; excluded.push(c); continue
    }

    // Bedrooms/bathrooms tolerance — only enforce if subject has the data
    if (filters.bedroomsTolerance != null && subject.bedrooms != null && c.bedrooms != null) {
      if (Math.abs(c.bedrooms - subject.bedrooms) > filters.bedroomsTolerance) {
        c.exclusion_reason = "bedrooms_out_of_tolerance"; excluded.push(c); continue
      }
    }
    if (filters.bathroomsTolerance != null && subject.bathrooms != null && c.bathrooms != null) {
      if (Math.abs(c.bathrooms - subject.bathrooms) > filters.bathroomsTolerance) {
        c.exclusion_reason = "bathrooms_out_of_tolerance"; excluded.push(c); continue
      }
    }

    kept.push(c)
  }

  return { kept, excluded }
}

function propertyTypeMatches(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().trim()
  const A = norm(a), B = norm(b)
  if (A === B) return true
  // Treat "casa" and "townhouse" as compatible
  if ((A === "house" && B === "house") || (A === "apartment" && B === "apartment")) return true
  return A === B
}
