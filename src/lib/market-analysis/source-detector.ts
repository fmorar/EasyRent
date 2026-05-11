// ============================================================
// Source Detector
//
// Classifies a pasted URL into:
//   • source name      → encuentra24 | mercadolibre | generic | unsupported
//   • source type      → listing_page | property_detail_page | unsupported
//   • detected category (best-effort)
//   • is_broad warning (no obvious filter applied)
//
// Pure function — no network calls. Lives in a shared file so both
// the create-form (client-side) and the run pipeline (server-side)
// can call it without duplicating heuristics.
// ============================================================

import type { SourceDetection } from "./types"

const ENCUENTRA24_HOSTS = ["encuentra24.com", "www.encuentra24.com"]
const MERCADOLIBRE_HOSTS = [
  "mercadolibre.com",         "mercadolibre.co.cr",
  "inmuebles.mercadolibre.com.mx", "casas.mercadolibre.com.ar",
]

export function detectSource(rawUrl: string): SourceDetection {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return {
      url:          rawUrl,
      source_name:  "unsupported",
      source_type:  "unsupported",
      warning:      "Invalid URL.",
    }
  }

  const host = url.hostname.toLowerCase()
  const path = url.pathname.toLowerCase()

  // ── Encuentra24 ─────────────────────────────────────────────
  if (ENCUENTRA24_HOSTS.some((h) => host === h || host.endsWith("." + h))) {
    return classifyEncuentra24(url, path)
  }

  // ── MercadoLibre (placeholder) ──────────────────────────────
  if (MERCADOLIBRE_HOSTS.some((h) => host === h || host.endsWith("." + h))) {
    // Detection only — extraction is a v2 stub
    return {
      url:         url.toString(),
      source_name: "mercadolibre",
      source_type: looksLikeDetailPath(path) ? "property_detail_page" : "listing_page",
      warning:     "MercadoLibre support is limited in MVP; results may be incomplete.",
    }
  }

  // ── Generic listing fallback ────────────────────────────────
  // We classify any HTTP(S) URL with promising real-estate keywords as
  // a listing page; otherwise unsupported.
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      url:         url.toString(),
      source_name: "unsupported",
      source_type: "unsupported",
      warning:     "Only http(s) URLs are supported.",
    }
  }

  const realEstateHints = [
    "apartamento", "casa", "alquiler", "venta", "renta", "inmueble",
    "real-estate", "property", "for-sale", "for-rent", "rental",
  ]
  const looksRealEstate = realEstateHints.some((k) => path.includes(k))

  if (!looksRealEstate) {
    return {
      url:         url.toString(),
      source_name: "unsupported",
      source_type: "unsupported",
      warning:     "We don't yet recognize this site as a real-estate listing source.",
    }
  }

  return {
    url:         url.toString(),
    source_name: "generic",
    source_type: looksLikeDetailPath(path) ? "property_detail_page" : "listing_page",
    is_broad:    true,
    warning:     "Generic source — extraction is best-effort. Use a specific listing portal for better accuracy.",
  }
}

// ── Encuentra24 specific heuristics ──────────────────────────────
function classifyEncuentra24(url: URL, path: string): SourceDetection {
  // Detail pages: end in `/id-N` or `/<numeric-id>` pattern
  // e.g. https://www.encuentra24.com/costa-rica-es/.../id-15234567
  if (/\/id-\d+\/?$/.test(path) || /\/\d{6,}\/?$/.test(path)) {
    return {
      url:         url.toString(),
      source_name: "encuentra24",
      source_type: "property_detail_page",
    }
  }

  // Listing/category page: `/costa-rica-es/bienes-raices-...`
  // Detect operation + property type from path tokens.
  let detectedCategory: string | undefined
  let isBroad = true

  if (path.includes("alquiler")) {
    if (path.includes("apartamentos")) detectedCategory = "rental_apartments"
    else if (path.includes("casas"))    detectedCategory = "rental_houses"
    else                                detectedCategory = "rental_other"
  } else if (path.includes("venta")) {
    if (path.includes("apartamentos")) detectedCategory = "sale_apartments"
    else if (path.includes("casas"))    detectedCategory = "sale_houses"
    else                                detectedCategory = "sale_other"
  }

  // Broad indicator: no query string (no filters), no canton in path
  const hasQuery       = url.search.length > 0
  const looksFiltered  = hasQuery
    || path.includes("provincia")
    || path.includes("canton")
    || /[a-z]{3,}-[a-z]{3,}/.test(path)   // hyphenated multi-word slug suggests a city/zone
  if (looksFiltered) isBroad = false

  return {
    url:               url.toString(),
    source_name:       "encuentra24",
    source_type:       "listing_page",
    detected_category: detectedCategory,
    is_broad:          isBroad,
    warning: isBroad
      ? "This URL covers a broad area. For better accuracy add filters (province, canton, price range, bedrooms)."
      : undefined,
  }
}

// ── Helpers ──────────────────────────────────────────────────────
function looksLikeDetailPath(path: string): boolean {
  return /\/id-\d+\/?$/.test(path)
      || /\/\d{6,}\/?$/.test(path)
      || /\-MLM-\d{6,}\b/i.test(path)
}
