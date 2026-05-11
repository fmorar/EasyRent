// ============================================================
// Generic listing adapter — best-effort fallback
//
// Used for any source we don't have a specific adapter for. We
// look for anchor tags pointing at numeric or "/p/" detail pages
// and extract whatever price/area/bedroom hints we can find from
// the surrounding card.
//
// Quality is much lower than a tuned adapter — the report should
// flag generic-source comparables as low-confidence.
// ============================================================

import * as cheerio from "cheerio"
import { fetchHtml } from "../fetcher"
import type { RealEstateSourceAdapter } from "./base"
import type { CrawledListing } from "../../types"

export const GenericListingAdapter: RealEstateSourceAdapter = {
  sourceName: "generic",

  canHandle() { return true },   // last-resort fallback

  detectUrlType(url) {
    try {
      const u = new URL(url)
      if (/\/p\/[\w-]+/.test(u.pathname) || /-\d{6,}\b/.test(u.pathname)) {
        return "property_detail_page"
      }
      return "listing_page"
    } catch { return "unsupported" }
  },

  async crawlListingPage({ url, scanDepth, maxListings }) {
    const collected: CrawledListing[] = []
    let pageUrl: string | null = url
    let depth = 0

    while (pageUrl && depth < scanDepth && collected.length < maxListings) {
      let html: string
      try { html = await fetchHtml(pageUrl) } catch { break }

      const $ = cheerio.load(html)
      $("a[href]").each((_i, a) => {
        if (collected.length >= maxListings) return false

        const href = $(a).attr("href")
        if (!href) return
        const text = $(a).closest("article, li, div").first().text().replace(/\s+/g, " ").trim()
        if (!text) return

        const priceMatch = text.match(/(US\$|\$|₡|CRC|USD)\s*([\d.,]+)/i)
        if (!priceMatch) return         // heuristic: real estate cards mention a price

        try {
          const detailUrl = new URL(href, pageUrl!).toString()
          collected.push({
            source_name: "generic",
            source_url:  pageUrl!,
            listing_url: detailUrl,
            title:       $(a).text().trim().slice(0, 120),
            raw_price:    priceMatch[0],
            raw_currency: priceMatch[1],
            raw_area:     pickRegex(text, /(\d+(?:\.\d+)?)\s*(m²|m2|mts2|mts)/i),
            raw_bedrooms: pickRegex(text, /(\d+)\s*(rec[áa]maras?|habitaci[oó]nes?|hab\b|bedrooms?)/i),
            raw_bathrooms: pickRegex(text, /(\d+)\s*(ba[ñn]os?|bathrooms?)/i),
            raw_text:     text.slice(0, 600),
          })
        } catch { /* ignore */ }
      })

      depth++
      pageUrl = null   // generic adapter doesn't follow pagination
    }

    // Dedup by listing_url
    const seen = new Set<string>()
    return collected.filter((c) => {
      if (!c.listing_url) return false
      if (seen.has(c.listing_url)) return false
      seen.add(c.listing_url)
      return true
    })
  },

  async crawlPropertyDetailPage({ url }) {
    let html: string
    try { html = await fetchHtml(url) } catch { return null }
    const $ = cheerio.load(html)
    const text = $("body").text().replace(/\s+/g, " ").trim()
    const priceMatch = text.match(/(US\$|\$|₡|CRC|USD)\s*([\d.,]+)/i)
    return {
      source_name:  "generic",
      source_url:   url,
      listing_url:  url,
      title:        $("h1").first().text().trim() || $("title").text().trim(),
      raw_price:    priceMatch?.[0],
      raw_currency: priceMatch?.[1],
      raw_area:     pickRegex(text, /(\d+(?:\.\d+)?)\s*(m²|m2|mts2|mts)/i),
      raw_bedrooms: pickRegex(text, /(\d+)\s*(rec[áa]maras?|habitaci[oó]nes?|hab\b|bedrooms?)/i),
      raw_bathrooms: pickRegex(text, /(\d+)\s*(ba[ñn]os?|bathrooms?)/i),
      raw_text:     text.slice(0, 2000),
    }
  },
}

function pickRegex(text: string, re: RegExp): string | undefined {
  const m = text.match(re)
  return m ? m[0] : undefined
}
