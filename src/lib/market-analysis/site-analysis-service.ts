// ============================================================
// Site Analysis Service — public maps (OpenStreetMap / Overpass)
//
// Given (lat, lng) for a subject property, queries Overpass once
// for everything we care about within a 2 km radius, then derives:
//
//   • POI counts at 3 radii (500m, 1km, 2km)
//   • Distance to the nearest of each key POI type
//   • Walkability tier (computed from POI density + transit)
//   • Environment classification (quiet / mixed / commercial)
//   • A small set of notable named landmarks
//
// All data is OSM, free, no API key. We cache by (lat,lng) per
// request to avoid re-querying when multiple consumers ask.
//
// Failure mode: returns null. Callers must treat the absence as
// "site analysis unavailable" — never block the report on it.
// ============================================================

// ── Public types ─────────────────────────────────────────────────
export interface PoiCounts {
  supermarkets: number
  schools:      number
  universities: number
  hospitals:    number
  pharmacies:   number
  restaurants:  number
  parks:        number
  gyms:         number
  banks:        number
  transit_stops: number
  malls:        number
}

export interface NearestPoi {
  name:       string
  distance_m: number
  lat:        number
  lng:        number
}

export interface NearestRoad {
  name:       string
  distance_m: number
  /** OSM highway class: motorway / trunk / primary / secondary. */
  highway:    string
}

export interface SiteAnalysis {
  /** Center of the analysis. */
  center: { lat: number; lng: number }

  /** Counts of POIs by category, at multiple radii. */
  counts: {
    r500m: PoiCounts
    r1km:  PoiCounts
    r2km:  PoiCounts
  }

  /** Distance to the nearest of each key POI type (when found within 2 km). */
  nearest: {
    hospital?:    NearestPoi
    school?:      NearestPoi
    supermarket?: NearestPoi
    park?:        NearestPoi
    transit?:     NearestPoi
    restaurant?:  NearestPoi
    pharmacy?:    NearestPoi
    bank?:        NearestPoi
    main_road?:   NearestRoad
  }

  /** Walkability tier — derived from POI density + transit. */
  walkability: {
    tier:  "high" | "medium" | "low"
    /** 0..100 score; tiers are >=70 high, >=40 medium, else low. */
    score: number
  }

  /** Coarse environment classification. */
  environment: "residential_quiet" | "residential_mixed" | "commercial" | "unknown"

  /** Up to 8 notable named landmarks within 1.5 km. */
  landmarks: { name: string; category: string; distance_m: number }[]

  /** Meta. */
  data_source:    "openstreetmap"
  fetched_at:     string
  coverage_note?: string
}

// ── Cache ────────────────────────────────────────────────────────
const cache = new Map<string, SiteAnalysis | null>()

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
]

const USER_AGENT = "re-platform-market-analysis/1.0 (site-analysis)"

// ── Public API ───────────────────────────────────────────────────
export async function getSiteAnalysis(
  lat: number, lng: number,
): Promise<SiteAnalysis | null> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`
  if (cache.has(key)) return cache.get(key)!

  const elements = await runOverpass(lat, lng)
  if (elements == null) {
    cache.set(key, null)
    return null
  }

  const analysis = buildAnalysis(lat, lng, elements)
  cache.set(key, analysis)
  return analysis
}

// ── Overpass query ───────────────────────────────────────────────
interface OverpassElement {
  type: "node" | "way" | "relation"
  id:   number
  lat?: number
  lon?: number
  /** For ways/relations: Overpass returns a center via `out center`. */
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

async function runOverpass(lat: number, lng: number): Promise<OverpassElement[] | null> {
  // One bigger query covers everything inside 2 km. We post-filter by
  // distance in code for the 500m / 1km buckets.
  //
  // - Nodes for POIs (shops, amenities, leisure, transit).
  // - Ways for major roads — we ask for the centerpoint via `out center`
  //   so we can compute a distance.
  const query = `
    [out:json][timeout:25];
    (
      node["shop"="supermarket"](around:2000,${lat},${lng});
      node["shop"="mall"](around:2000,${lat},${lng});
      node["shop"="department_store"](around:2000,${lat},${lng});
      node["shop"="convenience"](around:2000,${lat},${lng});
      node["amenity"="school"](around:2000,${lat},${lng});
      node["amenity"="kindergarten"](around:2000,${lat},${lng});
      node["amenity"="university"](around:2000,${lat},${lng});
      node["amenity"="college"](around:2000,${lat},${lng});
      node["amenity"="hospital"](around:2000,${lat},${lng});
      node["amenity"="clinic"](around:2000,${lat},${lng});
      node["amenity"="pharmacy"](around:2000,${lat},${lng});
      node["amenity"="restaurant"](around:2000,${lat},${lng});
      node["amenity"="cafe"](around:2000,${lat},${lng});
      node["amenity"="fast_food"](around:2000,${lat},${lng});
      node["amenity"="bank"](around:2000,${lat},${lng});
      node["amenity"="atm"](around:2000,${lat},${lng});
      node["amenity"="bus_station"](around:2000,${lat},${lng});
      node["leisure"="park"](around:2000,${lat},${lng});
      node["leisure"="fitness_centre"](around:2000,${lat},${lng});
      node["leisure"="sports_centre"](around:2000,${lat},${lng});
      node["public_transport"="stop_position"](around:2000,${lat},${lng});
      node["public_transport"="platform"](around:2000,${lat},${lng});
      node["highway"="bus_stop"](around:2000,${lat},${lng});
      way["highway"~"^(motorway|trunk|primary|secondary)$"](around:2000,${lat},${lng});
    );
    out tags center;
  `.trim()

  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method:  "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":   USER_AGENT,
          "Accept":       "application/json",
        },
        body:    `data=${encodeURIComponent(query)}`,
        signal:  AbortSignal.timeout(25000),
      })
      if (!res.ok) continue
      const json = await res.json() as { elements?: OverpassElement[] }
      return json.elements ?? []
    } catch {
      // try next endpoint
      continue
    }
  }
  return null
}

// ── Analysis ─────────────────────────────────────────────────────
type Category =
  | "supermarket" | "mall" | "school" | "university" | "hospital"
  | "pharmacy"    | "restaurant" | "park" | "gym" | "bank"
  | "transit"     | "clinic"

interface ClassifiedPoi {
  name:       string
  category:   Category
  lat:        number
  lng:        number
  distance_m: number
}

function buildAnalysis(
  centerLat: number, centerLng: number, elements: OverpassElement[],
): SiteAnalysis {
  // Classify nodes
  const pois: ClassifiedPoi[] = []
  let mainRoad: NearestRoad | undefined

  for (const e of elements) {
    const tags = e.tags ?? {}

    if (e.type === "way") {
      const hwy = tags["highway"]
      if (!hwy) continue
      const c = e.center
      if (!c) continue
      const d = haversine(centerLat, centerLng, c.lat, c.lon)
      // Keep the closest major road of the highest class we find. Order
      // priority: motorway > trunk > primary > secondary. Within the
      // same class, the closest wins.
      const rank = (h: string) =>
        h === "motorway" ? 4 : h === "trunk" ? 3 : h === "primary" ? 2 : h === "secondary" ? 1 : 0
      const newRank = rank(hwy)
      const oldRank = mainRoad ? rank(mainRoad.highway) : 0
      const closerOrBetter =
        !mainRoad ||
        newRank > oldRank ||
        (newRank === oldRank && d < mainRoad.distance_m)
      if (closerOrBetter) {
        mainRoad = {
          name:       tags["name"] ?? tags["ref"] ?? hwy,
          highway:    hwy,
          distance_m: Math.round(d),
        }
      }
      continue
    }

    // node
    if (e.lat == null || e.lon == null) continue
    const cat = classify(tags)
    if (!cat) continue
    pois.push({
      name:       tags["name"] ?? labelFor(cat),
      category:   cat,
      lat:        e.lat,
      lng:        e.lon,
      distance_m: Math.round(haversine(centerLat, centerLng, e.lat, e.lon)),
    })
  }

  // Counts at 3 radii
  const counts = {
    r500m: emptyCounts(),
    r1km:  emptyCounts(),
    r2km:  emptyCounts(),
  }
  for (const p of pois) {
    if (p.distance_m <= 2000) bumpCount(counts.r2km, p.category)
    if (p.distance_m <= 1000) bumpCount(counts.r1km, p.category)
    if (p.distance_m <= 500)  bumpCount(counts.r500m, p.category)
  }

  // Nearest of each key type. Track POI keys separately from the road
  // key so the assignment is type-safe (NearestPoi vs NearestRoad).
  const nearest: SiteAnalysis["nearest"] = {}
  const byCat = new Map<Category, ClassifiedPoi>()
  for (const p of pois) {
    const cur = byCat.get(p.category)
    if (!cur || p.distance_m < cur.distance_m) byCat.set(p.category, p)
  }
  type NearestPoiKey =
    "hospital" | "school" | "supermarket" | "park" |
    "transit"  | "restaurant" | "pharmacy" | "bank"
  const setPoi = (k: NearestPoiKey, cat: Category) => {
    const p = byCat.get(cat)
    if (!p) return
    nearest[k] = { name: p.name, distance_m: p.distance_m, lat: p.lat, lng: p.lng }
  }
  setPoi("hospital",    "hospital")
  setPoi("school",      "school")
  setPoi("supermarket", "supermarket")
  setPoi("park",        "park")
  setPoi("transit",     "transit")
  setPoi("restaurant",  "restaurant")
  setPoi("pharmacy",    "pharmacy")
  setPoi("bank",        "bank")
  if (mainRoad) nearest.main_road = mainRoad

  // Walkability score
  // Reward POI variety + density within 1km, with a transit bonus.
  const c1 = counts.r1km
  const variety =
    (c1.supermarkets > 0 ? 15 : 0) +
    (c1.schools > 0      ? 10 : 0) +
    (c1.parks > 0        ? 10 : 0) +
    (c1.restaurants > 0  ? 10 : 0) +
    (c1.pharmacies > 0   ? 5  : 0) +
    (c1.banks > 0        ? 5  : 0)
  const density = Math.min(
    25,
    (c1.restaurants * 1) + (c1.supermarkets * 3) + (c1.banks * 2) + (c1.malls * 4),
  )
  const transitBonus = Math.min(20, c1.transit_stops * 4)
  const rawScore = variety + density + transitBonus
  // Cap at 100 and round
  const score = Math.min(100, Math.round(rawScore))
  const tier: SiteAnalysis["walkability"]["tier"] =
    score >= 70 ? "high" : score >= 40 ? "medium" : "low"

  // Environment classification
  let environment: SiteAnalysis["environment"] = "unknown"
  const total1k =
    c1.supermarkets + c1.malls + c1.restaurants +
    c1.banks + c1.gyms + c1.pharmacies
  if (total1k >= 30 || c1.malls >= 1) environment = "commercial"
  else if (total1k >= 10)             environment = "residential_mixed"
  else if (pois.length > 0)           environment = "residential_quiet"

  // Notable landmarks (named, within 1.5 km)
  const landmarks = pois
    .filter((p) => p.distance_m <= 1500 && p.name && p.name !== labelFor(p.category))
    .sort((a, b) => a.distance_m - b.distance_m)
    .slice(0, 8)
    .map((p) => ({ name: p.name, category: p.category, distance_m: p.distance_m }))

  // Coverage note — OSM coverage is uneven outside GAM
  let coverageNote: string | undefined
  if (pois.length === 0 && !mainRoad) {
    coverageNote =
      "Cobertura de OpenStreetMap limitada en esta zona. Validá el entorno en sitio."
  } else if (pois.length < 5) {
    coverageNote =
      "Pocos puntos de interés disponibles en datos públicos. La realidad puede ser más rica."
  }

  return {
    center:        { lat: centerLat, lng: centerLng },
    counts,
    nearest,
    walkability:   { tier, score },
    environment,
    landmarks,
    data_source:   "openstreetmap",
    fetched_at:    new Date().toISOString(),
    coverage_note: coverageNote,
  }
}

// ── Helpers ──────────────────────────────────────────────────────
function classify(tags: Record<string, string>): Category | null {
  if (tags["shop"] === "supermarket")            return "supermarket"
  if (tags["shop"] === "convenience")            return "supermarket"
  if (tags["shop"] === "mall")                   return "mall"
  if (tags["shop"] === "department_store")       return "mall"
  if (tags["amenity"] === "school")              return "school"
  if (tags["amenity"] === "kindergarten")        return "school"
  if (tags["amenity"] === "university")          return "university"
  if (tags["amenity"] === "college")             return "university"
  if (tags["amenity"] === "hospital")            return "hospital"
  if (tags["amenity"] === "clinic")              return "clinic"
  if (tags["amenity"] === "pharmacy")            return "pharmacy"
  if (tags["amenity"] === "restaurant")          return "restaurant"
  if (tags["amenity"] === "cafe")                return "restaurant"
  if (tags["amenity"] === "fast_food")           return "restaurant"
  if (tags["amenity"] === "bank")                return "bank"
  if (tags["amenity"] === "atm")                 return "bank"
  if (tags["leisure"] === "park")                return "park"
  if (tags["leisure"] === "fitness_centre")      return "gym"
  if (tags["leisure"] === "sports_centre")       return "gym"
  if (tags["public_transport"])                  return "transit"
  if (tags["highway"] === "bus_stop")            return "transit"
  if (tags["amenity"] === "bus_station")         return "transit"
  return null
}

function emptyCounts(): PoiCounts {
  return {
    supermarkets: 0, schools: 0, universities: 0, hospitals: 0,
    pharmacies:   0, restaurants: 0, parks: 0, gyms: 0, banks: 0,
    transit_stops: 0, malls: 0,
  }
}

function bumpCount(c: PoiCounts, cat: Category) {
  switch (cat) {
    case "supermarket": c.supermarkets++; break
    case "mall":        c.malls++;        break
    case "school":      c.schools++;      break
    case "university":  c.universities++; break
    case "hospital":    c.hospitals++;    break
    case "clinic":      c.hospitals++;    break // count clinics with hospitals for coarse stat
    case "pharmacy":    c.pharmacies++;   break
    case "restaurant":  c.restaurants++;  break
    case "park":        c.parks++;        break
    case "gym":         c.gyms++;         break
    case "bank":        c.banks++;        break
    case "transit":     c.transit_stops++; break
  }
}

function labelFor(cat: Category): string {
  switch (cat) {
    case "supermarket": return "Supermercado"
    case "mall":        return "Centro comercial"
    case "school":      return "Escuela"
    case "university":  return "Universidad"
    case "hospital":    return "Hospital"
    case "clinic":      return "Clínica"
    case "pharmacy":    return "Farmacia"
    case "restaurant":  return "Restaurante"
    case "park":        return "Parque"
    case "gym":         return "Gimnasio"
    case "bank":        return "Banco / cajero"
    case "transit":     return "Transporte público"
  }
}

/** Haversine distance in meters. */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000 // Earth radius (m)
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}
