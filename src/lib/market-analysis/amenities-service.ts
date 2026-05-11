// ============================================================
// Amenities Service — OpenStreetMap Overpass
//
// Given a (lat, lng), counts notable POIs within a configurable
// radius (default 1 km). Used by the AI report to talk about the
// area's walkability and offerings.
//
// Overpass is community-funded — keep timeouts short and cache.
// ============================================================

interface AmenitiesSnapshot {
  supermarkets:    number
  parks:           number
  schools:         number
  universities:    number
  hospitals:       number
  restaurants:     number
  gyms:            number
  publicTransport: number
  commercial:      number
  notable:         string[]
}

const cache = new Map<string, AmenitiesSnapshot | null>()

export async function getNearbyAmenities(
  lat: number, lng: number, radiusMeters = 1000,
): Promise<AmenitiesSnapshot | null> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}|${radiusMeters}`
  if (cache.has(key)) return cache.get(key)!

  const query = `
    [out:json][timeout:15];
    (
      node["shop"="supermarket"](around:${radiusMeters},${lat},${lng});
      node["leisure"="park"](around:${radiusMeters},${lat},${lng});
      node["amenity"="school"](around:${radiusMeters},${lat},${lng});
      node["amenity"="university"](around:${radiusMeters},${lat},${lng});
      node["amenity"="hospital"](around:${radiusMeters},${lat},${lng});
      node["amenity"="restaurant"](around:${radiusMeters},${lat},${lng});
      node["leisure"="fitness_centre"](around:${radiusMeters},${lat},${lng});
      node["public_transport"="stop_position"](around:${radiusMeters},${lat},${lng});
      node["shop"~"mall|supermarket|department_store"](around:${radiusMeters},${lat},${lng});
    );
    out tags;
  `.trim()

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method:  "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":   "re-platform-market-analysis/1.0",
      },
      body:    `data=${encodeURIComponent(query)}`,
      signal:  AbortSignal.timeout(15000),
    })
    if (!res.ok) { cache.set(key, null); return null }
    const json = await res.json() as { elements?: Array<{ tags?: Record<string, string> }> }
    const elements = json.elements ?? []

    const snap: AmenitiesSnapshot = {
      supermarkets:    0, parks: 0, schools: 0, universities: 0,
      hospitals:       0, restaurants: 0, gyms: 0,
      publicTransport: 0, commercial: 0, notable: [],
    }

    for (const e of elements) {
      const tags = e.tags ?? {}
      if (tags["shop"] === "supermarket")           snap.supermarkets++
      else if (tags["leisure"] === "park")          snap.parks++
      else if (tags["amenity"] === "school")        snap.schools++
      else if (tags["amenity"] === "university")    snap.universities++
      else if (tags["amenity"] === "hospital")      snap.hospitals++
      else if (tags["amenity"] === "restaurant")    snap.restaurants++
      else if (tags["leisure"] === "fitness_centre") snap.gyms++
      else if (tags["public_transport"])             snap.publicTransport++
      else if (tags["shop"])                         snap.commercial++

      const name = tags["name"]
      if (name && snap.notable.length < 8 && !snap.notable.includes(name)) {
        snap.notable.push(name)
      }
    }

    cache.set(key, snap)
    return snap
  } catch {
    cache.set(key, null)
    return null
  }
}
