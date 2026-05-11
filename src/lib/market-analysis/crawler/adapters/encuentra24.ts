// ============================================================
// Encuentra24 adapter
//
// Strategy: SSR pages render every listing card in the initial
// HTML. We use the site's stable CSS-module class names
// (`card_container`, `card_title`, `card_price`, `card_specs`,
// etc.) and the dedicated `a.item-card-link` anchor.
//
// Pagination on the current site doesn't surface a `?p=N`
// parameter — the first page returns ~20 listings which is
// usually plenty. We attempt rel=next as a soft fallback but
// don't insist on it.
// ============================================================

import * as cheerio from "cheerio"
import type { AnyNode } from "domhandler"
import { fetchHtml } from "../fetcher"
import type { RealEstateSourceAdapter } from "./base"
import type { CrawledListing, CrawlDetailInput } from "../../types"

export const Encuentra24Adapter: RealEstateSourceAdapter = {
  sourceName: "encuentra24",

  canHandle(url) {
    try {
      const u = new URL(url)
      return /(^|\.)encuentra24\.com$/i.test(u.hostname)
    } catch { return false }
  },

  detectUrlType(url) {
    try {
      const u = new URL(url)
      const p = u.pathname.toLowerCase()
      // New scheme: `/.../<slug>/<numeric-id>` for detail pages.
      // Legacy: `/id-12345`. Both still answer detail content.
      if (/\/[0-9]{6,}\/?$/.test(p) || /\/id-\d+\/?$/.test(p)) {
        return "property_detail_page"
      }
      return "listing_page"
    } catch { return "unsupported" }
  },

  async crawlListingPage({ url, scanDepth, maxListings }) {
    const collected: CrawledListing[] = []
    let pageUrl: string | null = url
    let pagesScanned = 0

    while (pageUrl && pagesScanned < scanDepth && collected.length < maxListings) {
      let html: string
      try {
        html = await fetchHtml(pageUrl)
      } catch {
        break
      }

      const before = collected.length
      const cards  = parseListingCards(html, pageUrl)
      for (const c of cards) {
        if (collected.length >= maxListings) break
        // Dedup by listing_url across pages
        if (c.listing_url && collected.some((x) => x.listing_url === c.listing_url)) continue
        collected.push(c)
      }

      // If THIS page yielded zero new listings (despite returning HTML),
      // we're probably looping on the same content because the portal
      // ignored our pagination guess. Bail out to avoid wasting fetches.
      if (collected.length === before && pagesScanned > 0) break

      pagesScanned++
      pageUrl = findNextPageUrl(html, pageUrl)
    }

    return collected
  },

  async crawlPropertyDetailPage({ url }: CrawlDetailInput) {
    let html: string
    try {
      html = await fetchHtml(url)
    } catch {
      return null
    }
    return parseDetailPage(html, url)
  },
}

// ── Listing-card extraction ──────────────────────────────────────
function parseListingCards(html: string, sourceUrl: string): CrawledListing[] {
  const $ = cheerio.load(html)
  const out: CrawledListing[] = []
  const seen = new Set<string>()

  // Cards on the new layout are wrapped by `<a class="... item-card-link">`
  // with the listing detail URL as `href`. The legacy `/id-NNNN` pattern
  // is still picked up by `looksLikeListingHref` below as a safety net.
  const anchorSelector = "a.item-card-link, a[href*='/id-']"

  $(anchorSelector).each((_i, el) => {
    const $a   = $(el)
    const href = $a.attr("href")
    if (!href) return
    if (!looksLikeListingHref(href)) return

    const detailUrl = absUrl(href, sourceUrl)
    if (seen.has(detailUrl)) return
    seen.add(detailUrl)

    // The card root is the closest descendant container holding the
    // CSS-module classes (card_container / card_layout). Fall back to
    // the anchor itself if we can't find one (older markup).
    let $card: cheerio.Cheerio<AnyNode> = $a.find(".card_container").first()
    if ($card.length === 0) $card = $a.closest(".card_container")
    if ($card.length === 0) $card = $a as unknown as cheerio.Cheerio<AnyNode>

    const text = $card.text().replace(/\s+/g, " ").trim()
    if (!text) return

    // ── Field extraction (CSS-module classes) ─────────────────
    const title    = pickText($card, ".card_title") ?? deriveTitleFromHref(href)
    const subtitle = pickText($card, ".card_subtitle") ?? undefined
    const priceTxt = pickText($card, ".card_price") ?? pickText($card, ".card_priceRow")
    const maintTxt = pickText($card, ".card_commonExpenses") ?? pickText($card, ".card_commonExpensesRow")
    const specsTxt = pickText($card, ".card_specs")
    const descTxt  = pickText($card, ".card_description")

    // Price + currency
    const priceMatch    = (priceTxt ?? text).match(/(US\$|\$|₡|CRC|USD)\s*([\d.,]+)/i)
    const raw_price     = priceMatch ? priceMatch[0] : undefined
    const raw_currency  = priceMatch ? priceMatch[1] : undefined

    // Specs — the chip text reads "2 Recámaras", "2 Baños", "85 m²"
    const specsBlob = specsTxt ?? text
    const raw_bedrooms  = matchOne(specsBlob, /(\d+(?:\.\d+)?)\s*(rec[áa]maras?|habitaci[oó]nes?|hab\b|dormitorios?)/i)
    const raw_bathrooms = matchOne(specsBlob, /(\d+(?:\.\d+)?)\s*(ba[ñn]os?)/i)
    const raw_parking   = matchOne(specsBlob, /(\d+(?:\.\d+)?)\s*(parqueos?|estacionamientos?|parking|garages?)/i)
    const raw_area      = matchOne(specsBlob, /(\d+(?:\.\d+)?)\s*(m²|m2|mts2|mts)/i)

    // Maintenance fee
    const raw_maintenance = maintTxt
      ? (maintTxt.match(/[$₡]?[\d.,]+/)?.[0])
      : matchOne(text, /mantenimiento[:\s]+([₡$]?[\d.,]+)/i, 1)

    // Operation + property type from URL path (more reliable than any
    // text on the page).
    const path = new URL(sourceUrl).pathname.toLowerCase()
    const raw_operation =
      path.includes("alquiler") ? "alquiler" :
      path.includes("venta")    ? "venta"    : undefined
    const raw_property_type =
      path.includes("apartamento") ? "apartamento" :
      path.includes("casa")        ? "casa"        :
      path.includes("lote")        ? "lote"        :
      path.includes("local")       ? "local"       :
      path.includes("oficina")     ? "oficina"     : undefined

    // Featured chip
    const is_featured = /resaltado|destacado|featured/i.test(text)

    // Drop empty cards (no title and no price)
    if (!raw_price && !title) return

    out.push({
      source_name:        "encuentra24",
      source_url:         sourceUrl,
      listing_url:        detailUrl,
      title,
      raw_price,
      raw_currency,
      raw_area,
      raw_bedrooms,
      raw_bathrooms,
      raw_parking,
      raw_maintenance,
      raw_operation,
      raw_property_type,
      location_text:      subtitle ?? extractLocation($card, text),
      description:        descTxt,
      is_featured,
      raw_text:           text.slice(0, 1000),
    })
  })

  return out
}

// ── Detail-page extraction (single listing URL) ─────────────────
function parseDetailPage(html: string, sourceUrl: string): CrawledListing | null {
  const $ = cheerio.load(html)
  const title = $("h1").first().text().trim() || $("title").first().text().trim()
  const text  = $("body").text().replace(/\s+/g, " ").trim()
  if (!title && !text) return null

  const priceMatch = text.match(/(US\$|\$|₡|CRC|USD)\s*([\d.,]+)/i)

  return {
    source_name:        "encuentra24",
    source_url:         sourceUrl,
    listing_url:        sourceUrl,
    title,
    raw_price:          priceMatch?.[0],
    raw_currency:       priceMatch?.[1],
    raw_area:           matchOne(text, /(\d+(?:\.\d+)?)\s*(m²|m2|mts2|mts)/i),
    raw_bedrooms:       matchOne(text, /(\d+(?:\.\d+)?)\s*(rec[áa]maras?|habitaci[oó]nes?|hab\b)/i),
    raw_bathrooms:      matchOne(text, /(\d+(?:\.\d+)?)\s*(ba[ñn]os?)/i),
    raw_parking:        matchOne(text, /(\d+(?:\.\d+)?)\s*(parqueos?|estacionamientos?|parking)/i),
    raw_maintenance:    matchOne(text, /mantenimiento[:\s]+([₡$]?[\d.,]+)/i, 1),
    raw_text:           text.slice(0, 2000),
    description:        $("meta[name='description']").attr("content")?.trim(),
  }
}

// ── Helpers ──────────────────────────────────────────────────────
function absUrl(href: string, base: string): string {
  try { return new URL(href, base).toString() } catch { return href }
}

function pickText($card: cheerio.Cheerio<AnyNode>, selector: string): string | undefined {
  const t = $card.find(selector).first().text().replace(/\s+/g, " ").trim()
  return t.length > 0 ? t : undefined
}

function matchOne(text: string, re: RegExp, group = 0): string | undefined {
  const m = text.match(re)
  if (!m) return undefined
  return m[group] ?? m[0]
}

function looksLikeListingHref(href: string): boolean {
  // Detail page URLs end in `/id-NNNN` (legacy) or `/<slug>/<numeric-id>`
  // (current). Skip filter / category / map links.
  if (/\/id-\d+\/?$/.test(href)) return true
  if (/\/[0-9]{6,}\/?$/.test(href)) return true
  return false
}

function deriveTitleFromHref(href: string): string {
  // `/.../alquiler-de-apartamento-con-linea-blanca-san-ana/32367753` →
  // "Alquiler de apartamento con linea blanca san ana"
  const slug = href.split("/").filter(Boolean).slice(-2, -1)[0] ?? ""
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function extractLocation($card: cheerio.Cheerio<AnyNode>, fallback: string): string | undefined {
  const locRe = /([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ.\- ]+,\s*)+(San José|Alajuela|Cartago|Heredia|Guanacaste|Puntarenas|Limón)/
  const m = $card.text().match(locRe) ?? fallback.match(locRe)
  return m ? m[0].trim() : undefined
}

/**
 * Resolve the next page in a results pagination. Tries, in order:
 *
 *   1. `<link rel="next">` / `<a rel="next">` — when the portal
 *      bothers to emit them. encuentra24 currently doesn't, but other
 *      adapters reuse this fallthrough so we keep it first.
 *   2. Scan EVERY anchor on the page and find one whose URL is the
 *      same listing-results path with a higher page number than the
 *      current — we pick `currentPage + 1`. This catches both
 *      `?p=2` and path-segment patterns like `/v_2`, `/p-2`,
 *      `/pagina-2` regardless of which one the portal uses.
 *   3. Construct the next URL by incrementing whichever pagination
 *      token we can find on the current URL — or inject `?p=2` if
 *      the URL has no page marker at all.
 */
function findNextPageUrl(html: string, currentUrl: string): string | null {
  const $ = cheerio.load(html)

  // 1. Explicit rel=next
  const relNext = $("link[rel='next']").attr("href") ?? $("a[rel='next']").attr("href")
  if (relNext) return absUrl(relNext, currentUrl)

  // 2. Walk anchors. Find the smallest page number greater than the
  // current. This handles every flavour of pagination the portal can
  // throw at us.
  const currentPage = extractPageNum(currentUrl) ?? 1
  let bestNext: { url: string; page: number } | null = null
  $("a").each((_, el) => {
    const href = $(el).attr("href")
    if (!href) return
    const abs  = absUrl(href, currentUrl)
    const page = extractPageNum(abs)
    if (page == null || page <= currentPage) return
    if (!bestNext || page < bestNext.page) bestNext = { url: abs, page }
  })
  if (bestNext) return (bestNext as { url: string }).url

  // 3. Last resort: increment whatever the URL has (or inject `?p=2`).
  return constructNextPageUrl(currentUrl)
}

/** Pull a page number out of a URL, supporting query and path
 *  patterns. Returns null when no marker is present. */
function extractPageNum(url: string): number | null {
  try {
    const u = new URL(url)
    const q = u.searchParams.get("p") ?? u.searchParams.get("page")
    if (q && /^\d+$/.test(q)) return parseInt(q, 10)
    // Path: /v_N, /p_N, /p-N, /pag-N, /pagina-N, /page-N
    const m = u.pathname.match(/\/(v_|p_|p-|pag-|pagina-|page-)(\d+)(?:\/|$)/i)
    if (m) return parseInt(m[2], 10)
  } catch { /* noop */ }
  return null
}

/** Bump whichever pagination token we can find on the URL. When no
 *  marker is present we inject `?page=N` (encuentra24's actual
 *  scheme — verified via inspection; their server responds with new
 *  results and ignores `?p=N`). */
function constructNextPageUrl(currentUrl: string): string | null {
  try {
    const u = new URL(currentUrl)
    // Prefer `page` over `p` because the encuentra24 server treats
    // `p` as a no-op. If the URL HAS `?p=N` we still bump it (in case
    // a different portal uses that param).
    const pg = u.searchParams.get("page")
    if (pg && /^\d+$/.test(pg)) {
      u.searchParams.set("page", String(parseInt(pg, 10) + 1))
      return u.toString()
    }
    const p = u.searchParams.get("p")
    if (p && /^\d+$/.test(p)) {
      u.searchParams.set("p", String(parseInt(p, 10) + 1))
      return u.toString()
    }
    const re = /\/(v_|p_|p-|pag-|pagina-|page-)(\d+)(\/|$)/i
    if (re.test(u.pathname)) {
      u.pathname = u.pathname.replace(re, (_, prefix: string, n: string, suffix: string) =>
        `/${prefix}${parseInt(n, 10) + 1}${suffix}`,
      )
      return u.toString()
    }
    // No marker — inject `?page=2` (the format encuentra24 honours).
    u.searchParams.set("page", "2")
    return u.toString()
  } catch { /* noop */ }
  return null
}
