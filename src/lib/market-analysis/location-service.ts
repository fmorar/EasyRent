// ============================================================
// Location Service — best-effort geocoding via OpenStreetMap
//
// Used to:
//   • upgrade comparables that have only a free-text "location_text"
//   • derive lat/lng for amenity lookups
//
// Nominatim usage policy: max 1 req/sec, must send User-Agent.
// We keep a tiny in-process LRU cache to avoid duplicate calls
// inside a single report run.
// ============================================================

interface GeocodeResult {
  latitude:   number
  longitude:  number
  display:    string
  province?:  string
  canton?:    string
  district?:  string
}

const cache = new Map<string, GeocodeResult | null>()
const MAX_CACHE = 500
let lastCallAt = 0

const USER_AGENT = "re-platform-market-analysis/1.0 (+contact: ops@re-platform.local)"

export async function geocodeLocation(query: string): Promise<GeocodeResult | null> {
  const key = query.trim().toLowerCase()
  if (!key) return null
  if (cache.has(key)) return cache.get(key)!

  // Throttle: ~1 req/second
  const now = Date.now()
  const wait = Math.max(0, 1100 - (now - lastCallAt))
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCallAt = Date.now()

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search")
    url.searchParams.set("q", `${query}, Costa Rica`)
    url.searchParams.set("format", "json")
    url.searchParams.set("limit", "1")
    url.searchParams.set("addressdetails", "1")
    url.searchParams.set("countrycodes", "cr")

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "es" },
      signal: AbortSignal.timeout(7000),
    })
    if (!res.ok) {
      cacheSet(key, null)
      return null
    }
    const arr = await res.json() as Array<{
      lat: string; lon: string; display_name: string;
      address?: Record<string, string>
    }>
    if (!arr || arr.length === 0) {
      cacheSet(key, null)
      return null
    }
    const r = arr[0]
    const result: GeocodeResult = {
      latitude:  parseFloat(r.lat),
      longitude: parseFloat(r.lon),
      display:   r.display_name,
      province:  r.address?.state ?? r.address?.province,
      canton:    r.address?.county ?? r.address?.city,
      district:  r.address?.suburb ?? r.address?.village ?? r.address?.town,
    }
    cacheSet(key, result)
    return result
  } catch {
    cacheSet(key, null)
    return null
  }
}

function cacheSet(key: string, val: GeocodeResult | null) {
  if (cache.size >= MAX_CACHE) {
    const first = cache.keys().next().value
    if (first) cache.delete(first)
  }
  cache.set(key, val)
}
