"use server"

import type { AddressSuggestion, GeocodeResult } from "./geocoding.types"

// Nominatim addressdetails object (partial)
interface NominatimAddress {
  road?:          string
  house_number?:  string
  neighbourhood?: string
  suburb?:        string
  quarter?:       string
  city?:          string
  town?:          string
  village?:       string
  municipality?:  string
  county?:        string
  state?:         string
  country?:       string
  postcode?:      string
}

// Build a neighbourhood/city-level string with no street info.
//
// `addressDetails` from Nominatim is unreliable for Costa Rica — many
// rows lack `neighbourhood`/`suburb`/`city` tags. As a safety net we
// also let callers pass the raw `display_name`, from which we pluck
// the second-to-last meaningful segment (typically the neighborhood).
function toApproximate(addr: NominatimAddress, displayName?: string): string {
  const fromTags = [
    addr.neighbourhood ?? addr.suburb ?? addr.quarter,
    addr.city ?? addr.town ?? addr.village ?? addr.municipality,
    addr.state ?? addr.county,
    addr.country,
  ].filter(Boolean).join(", ")

  // If the tag-based version is too generic (no neighbourhood-level
  // detail), fall back to mining the displayName — drop the first
  // segment (street) and any pure-numeric postal-code segment, then
  // keep the next 3 segments which usually land us at neighbourhood
  // + city + country.
  const hasGranular = !!(addr.neighbourhood ?? addr.suburb ?? addr.quarter)
  if (!hasGranular && displayName) {
    const parts = displayName
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && !/^\d{4,6}$/.test(s))   // drop postal codes

    // Strip the first segment (street + number) and keep the next 2-3
    // hops which give neighborhood-or-suburb level granularity.
    const trimmed = parts.slice(1, 4).join(", ")
    if (trimmed) return trimmed
  }

  return fromTags
}

const HEADERS = {
  "User-Agent":      "RealEstateTool/1.0",
  "Accept-Language": "es,en;q=0.9",
}

// ── Search ────────────────────────────────────────────────────────
export async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
  if (query.trim().length < 3) return []

  const params = new URLSearchParams({
    q:              query,
    format:         "jsonv2",
    addressdetails: "1",
    limit:          "6",
    dedupe:         "1",
  })

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      { headers: HEADERS, next: { revalidate: 3600 } },
    )
    if (!res.ok) return []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[] = await res.json()

    return data.map((r) => {
      const parts = (r.display_name as string).split(",").map((s: string) => s.trim())
      const addr: NominatimAddress = r.address ?? {}
      return {
        id:              String(r.place_id),
        displayName:     r.display_name as string,
        shortName:       parts[0] ?? "",
        secondaryName:   parts.slice(1).join(", "),
        approximateName: toApproximate(addr, r.display_name as string),
        lat:             parseFloat(r.lat),
        // Nominatim returns longitude as `lon`, NOT `lng` — common gotcha.
        lng:             parseFloat(r.lon),
      }
    })
  } catch {
    return []
  }
}

// ── Geocode a free-text address → approximate name + coordinates ──
// Used when the user types an address manually without picking from autocomplete
export async function geocodeToApproximate(address: string): Promise<GeocodeResult | null> {
  if (address.trim().length < 3) return null

  const params = new URLSearchParams({
    q:              address,
    format:         "jsonv2",
    addressdetails: "1",
    limit:          "1",
  })

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      { headers: HEADERS, next: { revalidate: 3600 } },
    )
    if (!res.ok) return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[] = await res.json()
    if (!data[0]) return null

    const addr: NominatimAddress = data[0].address ?? {}
    const approx = toApproximate(addr, data[0].display_name as string)
    const lat    = parseFloat(data[0].lat)
    // Nominatim returns longitude as `lon`, NOT `lng`.
    const lng    = parseFloat(data[0].lon)
    if (!approx || Number.isNaN(lat) || Number.isNaN(lng)) return null

    return { approximateName: approx, lat, lng }
  } catch {
    return null
  }
}
