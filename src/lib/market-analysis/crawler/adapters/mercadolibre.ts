// ============================================================
// MercadoLibre adapter — placeholder
//
// MercadoLibre's listing pages render heavily via JS. A full
// implementation needs Playwright or the public Items API. For
// MVP we return an empty result and let the source be flagged
// as "limited".
// ============================================================

import type { RealEstateSourceAdapter } from "./base"

export const MercadoLibreAdapter: RealEstateSourceAdapter = {
  sourceName: "mercadolibre",

  canHandle(url) {
    try {
      const u = new URL(url)
      return /mercadolibre\./i.test(u.hostname)
    } catch { return false }
  },

  detectUrlType(url) {
    try {
      const u = new URL(url)
      if (/-MLM-\d+\b/i.test(u.pathname) || /\/MLA-\d+/i.test(u.pathname)) {
        return "property_detail_page"
      }
      return "listing_page"
    } catch { return "unsupported" }
  },

  async crawlListingPage() {
    return []
  },

  async crawlPropertyDetailPage() {
    return null
  },
}
