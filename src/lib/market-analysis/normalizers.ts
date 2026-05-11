// ============================================================
// Normalizers — turn messy scraped strings into engine-ready data
//
// Pure functions. Heavy with regex. Each returns either the parsed
// value or `undefined` so the caller can keep partial data.
// ============================================================

import type { CrawledListing, NormalizedListing } from "./types"

// ── Numbers ──────────────────────────────────────────────────────
//
// Locale-aware-ish numeric parser. We see five real shapes from
// Costa Rica + LATAM real-estate listings:
//   • "1,300"        US thousands separator       → 1300
//   • "1,300.50"     US format                    → 1300.5
//   • "1.300"        ES/EU thousands separator    → 1300
//   • "1.300,50"     ES/EU format                 → 1300.5
//   • "1300"         no separators                → 1300
//
// Heuristic:
//   1. If both `,` and `.` appear → the LAST one is the decimal mark,
//      the other is the thousands separator (drop all of them).
//   2. If only one separator appears → look at the digits AFTER it:
//      exactly 3 digits → thousands separator (drop it);
//      otherwise        → decimal mark.
//
// The previous version always treated a single comma as a decimal,
// which mangled US-formatted prices like "$1,300" into 1.3.
export function parseNumber(input: string | null | undefined): number | undefined {
  if (input == null) return undefined
  const s = String(input).trim()
  if (!s) return undefined
  // Strip currency symbols, units, whitespace.
  const cleaned = s.replace(/[^\d.,-]/g, "")
  if (!cleaned) return undefined

  const lastComma = cleaned.lastIndexOf(",")
  const lastDot   = cleaned.lastIndexOf(".")
  const hasComma  = lastComma >= 0
  const hasDot    = lastDot   >= 0

  let normalized: string
  if (hasComma && hasDot) {
    // Mixed — last separator wins as decimal mark.
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".")
    } else {
      normalized = cleaned.replace(/,/g, "")
    }
  } else if (hasComma) {
    // Only commas — count digits after the LAST comma. Three digits
    // means thousands separator (e.g. "1,300"). Two or four+ digits
    // means it's the decimal mark (e.g. "1,30" or "1,3000").
    const tail = cleaned.length - lastComma - 1
    if (tail === 3) {
      // Thousands separator → drop every comma.
      normalized = cleaned.replace(/,/g, "")
    } else {
      // Decimal mark.
      normalized = cleaned.replace(",", ".")
    }
  } else if (hasDot) {
    // Only dots — symmetric heuristic.
    const tail = cleaned.length - lastDot - 1
    if (tail === 3 && cleaned.indexOf(".") !== lastDot) {
      // Multiple dots, last one with 3 digits → all thousands separators
      // (e.g. "1.234.567"). Drop every dot.
      normalized = cleaned.replace(/\./g, "")
    } else if (tail === 3 && /^\d+\.\d{3}$/.test(cleaned)) {
      // Single dot with 3 trailing digits and 1-3 leading digits is
      // ambiguous ("1.300" could be 1.3 or 1300). For real-estate
      // prices treat it as a thousands separator.
      normalized = cleaned.replace(".", "")
    } else {
      normalized = cleaned
    }
  } else {
    normalized = cleaned
  }

  const n = parseFloat(normalized)
  return Number.isFinite(n) ? n : undefined
}

// ── Currency ─────────────────────────────────────────────────────
export function normalizeCurrency(rawPrice?: string, rawCurrency?: string): "USD" | "CRC" | undefined {
  const blob = `${rawCurrency ?? ""} ${rawPrice ?? ""}`.toLowerCase()
  if (/(₡|crc|colon|colón|colones)/.test(blob)) return "CRC"
  if (/(\$|us\$|usd|dolar|dólar|dollar)/.test(blob)) return "USD"
  if (rawPrice && rawPrice.length > 0) {
    // Heuristic: prices in the millions are likely CRC; prices < 100k are likely USD for sale
    const n = parseNumber(rawPrice)
    if (n != null) {
      if (n >= 1_000_000) return "CRC"
      return "USD"
    }
  }
  return undefined
}

// ── Area ─────────────────────────────────────────────────────────
export function parseArea(input?: string): number | undefined {
  if (!input) return undefined
  const m = input.match(/(\d[\d.,]*)\s*(m²|m2|mts2|mts|metros)/i)
  if (m) return parseNumber(m[1])
  return parseNumber(input)
}

// ── Bedrooms / Bathrooms / Parking ──────────────────────────────
export function parseRoomCount(input?: string): number | undefined {
  if (!input) return undefined
  const m = input.match(/(\d+(?:\.\d+)?)/)
  if (!m) return undefined
  return parseNumber(m[1])
}

// ── Operation type ──────────────────────────────────────────────
export function inferOperation(
  raw?: string, urlOrTitle?: string,
): "sale" | "rent" | undefined {
  const blob = `${raw ?? ""} ${urlOrTitle ?? ""}`.toLowerCase()
  if (/(alquiler|renta|rent|for[- ]rent|en[- ]alquiler)/.test(blob)) return "rent"
  if (/(venta|sale|for[- ]sale|en[- ]venta)/.test(blob)) return "sale"
  return undefined
}

// ── Property type ───────────────────────────────────────────────
export function inferPropertyType(
  raw?: string, urlOrTitle?: string,
): string | undefined {
  const blob = `${raw ?? ""} ${urlOrTitle ?? ""}`.toLowerCase()
  if (/(apartamento|apto\b|apt\b|apartment|piso\b|condo)/.test(blob)) return "apartment"
  if (/(casa\b|house|townhouse|villa)/.test(blob)) return "house"
  if (/(lote\b|terreno|land|lot)/.test(blob)) return "land"
  if (/(local\b|comercial|commercial|store|tienda)/.test(blob)) return "commercial"
  if (/(oficina|office)/.test(blob)) return "office"
  if (/(bodega|warehouse|nave)/.test(blob)) return "warehouse"
  return undefined
}

// ── Costa Rica location text → province / canton / district ─────
//
// Best-effort split on commas + last-known-canton heuristic. The
// LocationService can later upgrade this with Nominatim.
const CR_PROVINCES = new Set([
  "san jose", "san josé",
  "alajuela",
  "cartago",
  "heredia",
  "guanacaste",
  "puntarenas",
  "limon", "limón",
])

export function parseLocationText(input?: string): {
  province?: string; canton?: string; district?: string; neighborhood?: string
} {
  if (!input) return {}
  const parts = input.split(/[,;|·]/).map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return {}

  // Find the last province match
  let provinceIdx = -1
  for (let i = parts.length - 1; i >= 0; i--) {
    const lower = parts[i].toLowerCase()
    if (CR_PROVINCES.has(lower)) {
      provinceIdx = i
      break
    }
  }

  if (provinceIdx < 0) {
    // No province token — assume the whole string is "neighborhood, canton" or just freeform
    return { neighborhood: parts[0], canton: parts[1], district: parts[2] }
  }

  const province = parts[provinceIdx]
  const before   = parts.slice(0, provinceIdx)
  // Common pattern: "<district>, <canton>, <province>"
  const canton       = before[before.length - 1]
  const district     = before[before.length - 2]
  const neighborhood = before.length >= 3 ? before[0] : undefined

  return {
    province:     normalizeProvinceName(province),
    canton,
    district,
    neighborhood,
  }
}

function normalizeProvinceName(p: string): string {
  const lower = p.toLowerCase()
  if (lower.startsWith("san j")) return "San José"
  if (lower.startsWith("limon") || lower.startsWith("limón")) return "Limón"
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
}

// ── Top-level normalize ─────────────────────────────────────────
export function normalizeListing(c: CrawledListing): NormalizedListing {
  const currency = normalizeCurrency(c.raw_price, c.raw_currency)
  const price    = parseNumber(c.raw_price)
  const area     = parseArea(c.raw_area)
  const bedrooms = parseRoomCount(c.raw_bedrooms)
  const bathrooms = parseRoomCount(c.raw_bathrooms)
  const parking   = parseRoomCount(c.raw_parking)
  const maint     = parseNumber(c.raw_maintenance)
  const operation = inferOperation(c.raw_operation, c.title ?? c.listing_url)
  const propType  = inferPropertyType(c.raw_property_type, c.title ?? c.listing_url)
  const loc       = parseLocationText(c.location_text)

  const price_per_m2 = (price != null && area != null && area > 0) ? price / area : undefined

  return {
    source_name:     c.source_name,
    source_url:      c.source_url,
    listing_url:     c.listing_url,
    title:           c.title?.trim(),
    operation_type:  operation,
    property_type:   propType,
    price,
    currency,
    maintenance_fee: maint,
    bedrooms,
    bathrooms,
    parking_spaces:  parking,
    built_area_m2:   area,
    price_per_m2,
    location_text:   c.location_text?.trim(),
    province:        loc.province,
    canton:          loc.canton,
    district:        loc.district,
    neighborhood:    loc.neighborhood,
    amenities:       c.amenities,
    description:     c.description,
    agent_or_company: c.agent_or_company,
    is_featured:     c.is_featured,
    raw_text:        c.raw_text,
    extracted_data:  c.extracted_data,
  }
}
