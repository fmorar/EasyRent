// Detail-page enrichment for the owner prospector.
//
// The encuentra24 search-results card doesn't expose the advertiser
// reliably — the right sidebar of each listing's DETAIL page is where
// the signal lives. So we follow each `listing_url`, parse the
// advertiser block, and feed two new signals back into the
// classifier:
//
//   1. Role badge: "PARTICULAR" (individual / owner) or "PROFESIONAL"
//      (agency / agent). This is the most reliable single bit
//      encuentra24 publishes.
//   2. Repetition across the result set: if "NOVUS INMOBILIARIA"
//      appears on 4 listings in this scan, every one of those is
//      almost certainly an agent listing.
//
// We respect the existing fetcher's rate limit (1 req/sec/host) and
// cap concurrency at 4. Worst case ~30 listings ≈ 8 seconds of fetch
// after the initial crawl.

import * as cheerio from "cheerio"
import { fetchHtml } from "@/lib/market-analysis/crawler/fetcher"

export interface AdvertiserInfo {
  /** The displayed name in the listing's sidebar. e.g. "NOVUS INMOBILIARIA"
   *  or "Carlos Vargas". `null` when the page didn't expose one. */
  name: string | null
  /** "particular" = individual / owner. "professional" = agency / agent.
   *  `null` when no badge was visible. */
  role: "particular" | "professional" | null
  /** Phone number shown on the listing, if any. Useful for cold outreach. */
  phone: string | null
  /** Absolute URL of the advertiser's profile / "see all listings" page.
   *  This is the link we follow next to count their actual total. */
  profileUrl: string | null
}

export interface EnrichmentByUrl {
  /** Map of `listing_url → AdvertiserInfo` for every listing we
   *  successfully enriched. Missing keys = enrichment failed. */
  advertisers: Map<string, AdvertiserInfo>
  /** Cross-listing repetition WITHIN this scan, by lowercased name.
   *  Kept as a soft fallback when we can't reach the profile page. */
  occurrencesByName: Map<string, number>
  /** Total listings counted on each unique advertiser PROFILE page.
   *  Keyed by lowercased profile URL. This is the real signal:
   *  an agent typically has 5+ active listings, an owner usually has 1. */
  totalsByProfileUrl: Map<string, number>
}

const MAX_CONCURRENT = 4

/**
 * Two-phase enrichment:
 *   1. Detail pages — extract the advertiser block from every listing
 *      so we have name + role + phone + profile URL.
 *   2. Profile pages — for each UNIQUE advertiser profile URL, fetch
 *      the page once and count their total active listings. This is
 *      the real signal: agents typically have 5+ listings on their
 *      profile, owners usually have 1.
 *
 * Failures are silent per-URL — if a fetch fails, the prospector
 * falls back to the text + (weaker) in-scan repetition signals.
 */
export async function enrichListingsWithAdvertiser(
  urls: string[],
): Promise<EnrichmentByUrl> {
  const unique = Array.from(new Set(urls.filter(Boolean)))
  const advertisers = new Map<string, AdvertiserInfo>()

  // ── Phase 1: detail pages ─────────────────────────────────────
  let i = 0
  async function detailWorker() {
    while (i < unique.length) {
      const idx = i++
      const url = unique[idx]
      const info = await enrichOne(url).catch(() => null)
      if (info) advertisers.set(url, info)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENT, unique.length) }, detailWorker),
  )

  // ── Phase 2: profile pages ────────────────────────────────────
  // Collect unique profile URLs and fetch each ONE time. Cache results
  // by lowercased URL so two listings pointing at the same advertiser
  // share one fetch.
  const profileUrls = Array.from(new Set(
    Array.from(advertisers.values())
      .map((a) => a.profileUrl?.toLowerCase().trim())
      .filter((u): u is string => !!u),
  ))
  const totalsByProfileUrl = new Map<string, number>()
  let j = 0
  async function profileWorker() {
    while (j < profileUrls.length) {
      const idx = j++
      const url = profileUrls[idx]
      const count = await countProfileListings(url).catch(() => null)
      if (count != null) totalsByProfileUrl.set(url, count)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENT, profileUrls.length) }, profileWorker),
  )

  // ── In-scan repetition (kept as a soft signal). ───────────────
  const occurrencesByName = new Map<string, number>()
  for (const info of advertisers.values()) {
    if (!info.name) continue
    const key = info.name.toLowerCase().trim()
    occurrencesByName.set(key, (occurrencesByName.get(key) ?? 0) + 1)
  }

  return { advertisers, occurrencesByName, totalsByProfileUrl }
}

// ── Per-URL extraction ──────────────────────────────────────────────
async function enrichOne(url: string): Promise<AdvertiserInfo | null> {
  if (!/^https?:\/\//i.test(url)) return null
  const html = await fetchHtml(url)
  return parseAdvertiserBlock(html, url)
}

/**
 * Pull the advertiser name + role badge + profile URL out of the
 * listing detail HTML. Tries 5 strategies in order — when one of the
 * later ones succeeds we accept it. The portal renames its CSS
 * modules every deploy, so the parser is intentionally redundant.
 *
 * Strategies (in priority order):
 *   1. JSON-LD `Organization` / `RealEstateAgent` / `Person` (most
 *      reliable; portals often embed structured data for SEO).
 *   2. Open Graph meta tags (`og:author`, `article:author`).
 *   3. Anchor whose href looks like a profile path (broadened pattern).
 *   4. Anchor near a "Publicado por" / "Anunciado por" / "Contacto"
 *      label.
 *   5. Text fallback — line before the PROFESIONAL/PARTICULAR badge.
 *
 * `baseUrl` is the listing URL; we resolve relative `href`s against
 * it so the returned `profileUrl` is absolute and re-fetchable.
 */
export function parseAdvertiserBlock(html: string, baseUrl: string): AdvertiserInfo {
  const $ = cheerio.load(html)
  const bodyText = $("body").text()
  const normalized = bodyText.replace(/\s+/g, " ")

  // ── Role badge ───────────────────────────────────────────────
  let role: AdvertiserInfo["role"] = null
  if (/\bPARTICULAR\b/.test(normalized))   role = "particular"
  if (/\bPROFESIONAL\b/.test(normalized))  role = "professional"
  // When both appear we trust "PROFESIONAL" — safer for outreach.
  if (/\bPROFESIONAL\b/.test(normalized) && /\bPARTICULAR\b/.test(normalized)) {
    role = "professional"
  }

  // ── Name + profile URL — collected by trying each strategy. ──
  let name:       string | null = null
  let profileUrl: string | null = null

  // Strategy 1 — JSON-LD structured data. Portals SSR an `Offer` or
  // `RealEstateListing` block referencing the seller/agent. We accept
  // anything that has a `name`.
  $('script[type="application/ld+json"]').each((_, el) => {
    if (name) return
    try {
      const txt = $(el).text().trim()
      if (!txt) return
      const json: unknown = JSON.parse(txt)
      const candidates: unknown[] = Array.isArray(json) ? json : [json]
      for (const node of candidates) {
        if (!node || typeof node !== "object") continue
        const obj = node as Record<string, unknown>
        // Direct seller / agent / offeredBy / brand
        for (const key of ["seller", "agent", "broker", "offeredBy", "author", "brand", "provider"]) {
          const v = obj[key]
          if (v && typeof v === "object") {
            const inner = v as Record<string, unknown>
            if (typeof inner.name === "string" && inner.name.length >= 2) {
              name = cleanName(inner.name)
              if (typeof inner.url === "string") profileUrl = absUrl(inner.url, baseUrl)
              return
            }
          } else if (typeof v === "string" && v.length >= 2 && v.length <= 120) {
            name = cleanName(v)
            return
          }
        }
        // Nested `offers.seller` is the most common shape for listings.
        const offers = obj.offers
        if (offers && typeof offers === "object") {
          const seller = (offers as Record<string, unknown>).seller
          if (seller && typeof seller === "object") {
            const sellerObj = seller as Record<string, unknown>
            if (typeof sellerObj.name === "string") {
              name = cleanName(sellerObj.name)
              if (typeof sellerObj.url === "string") profileUrl = absUrl(sellerObj.url, baseUrl)
              return
            }
          }
        }
      }
    } catch {
      // Ignore malformed JSON-LD — fall through to other strategies.
    }
  })

  // Strategy 2 — Open Graph / Twitter meta authors.
  if (!name) {
    const metaCandidates = [
      $('meta[property="article:author"]').attr("content"),
      $('meta[name="author"]').attr("content"),
      $('meta[property="og:site_name"]').attr("content"),
    ]
    for (const c of metaCandidates) {
      if (c && c.length >= 2 && c.length <= 120 && !/^https?:/i.test(c)) {
        // Skip generic site names like "Encuentra24" — they don't help.
        if (!/^encuentra24$|^mercadolibre$/i.test(c.trim())) {
          name = cleanName(c)
          break
        }
      }
    }
  }

  // Strategy 3 — anchor with a profile-shaped href. We broaden the
  // pattern: many sites use slugs like `/u/`, `/agent/`, `/empresa/`,
  // `/realtor/`, `/account/`, `/store/`. We exclude anchors whose
  // text is empty, a URL, or obvious nav copy.
  $("a").each((_, el) => {
    if (profileUrl && name) return
    const href = $(el).attr("href") ?? ""
    if (!isProfileHref(href)) return
    const t = ($(el).text() ?? "").trim()
    const looksLikeName = t.length >= 2 && t.length <= 80 && !/^https?:/i.test(t)
      && !/^(ver|see|view|todos|all|inicio|home|atras|back)$/i.test(t)
    if (looksLikeName && !name)        name = cleanName(t)
    if (!profileUrl)                   profileUrl = absUrl(href, baseUrl)
  })

  // Strategy 4 — text near "Publicado por X" / "Anunciado por X" /
  // "Atendido por X" / "Contacto:" labels. These show up consistently
  // across encuentra24, MercadoLibre, OLX-style portals.
  if (!name) {
    const labelPatterns = [
      /Publicado\s+por[:\s]+([A-Za-zÁÉÍÓÚÑáéíóúñ0-9.,&'\- ]{2,80})/i,
      /Anunciado\s+por[:\s]+([A-Za-zÁÉÍÓÚÑáéíóúñ0-9.,&'\- ]{2,80})/i,
      /Atendido\s+por[:\s]+([A-Za-zÁÉÍÓÚÑáéíóúñ0-9.,&'\- ]{2,80})/i,
      /Inmobiliaria[:\s]+([A-Za-zÁÉÍÓÚÑáéíóúñ0-9.,&'\- ]{2,80})/i,
      /Vendedor[:\s]+([A-Za-zÁÉÍÓÚÑáéíóúñ0-9.,&'\- ]{2,80})/i,
    ]
    for (const re of labelPatterns) {
      const m = normalized.match(re)
      if (m && m[1]) {
        // Trim to one line — labels like "Publicado por Carlos\n+506 …"
        // would otherwise grab the phone next.
        const candidate = m[1].split(/\s{2,}|\n/)[0].trim()
        if (candidate.length >= 2) {
          name = cleanName(candidate)
          break
        }
      }
    }
  }

  // Strategy 5 — line directly before the role badge. Cheapest
  // fallback when nothing else fired and we at least know the badge.
  if (!name && role) {
    const badge = role === "professional" ? "PROFESIONAL" : "PARTICULAR"
    const re = new RegExp(`([A-ZÁÉÍÓÚÑ0-9 .,&'\\-]{3,80})\\s+${badge}\\b`)
    const m = normalized.match(re)
    if (m) name = cleanName(m[1])
  }

  // ── Phone — CR 8-digit, optionally prefixed by +506. ─────────
  let phone: string | null = null
  const phoneMatch = bodyText.match(/(?:\+\s*506[\s-]?)?(\d{4}[\s-]?\d{4})/)
  if (phoneMatch && /^\d{4}[\s-]?\d{4}$/.test(phoneMatch[1])) {
    phone = `+506 ${phoneMatch[1].replace(/[\s-]/g, "")}`
  }

  return { name, role, phone, profileUrl }
}

// ── Profile-page count ──────────────────────────────────────────────
/**
 * Visit an advertiser's profile / "all listings" page and return how
 * many active listings they have. We try three strategies:
 *
 *   1. Parse a "Mostrando 1-20 de N" / "N anuncios" / "N propiedades"
 *      number from the HTML — most accurate when present.
 *   2. Count anchors that look like listing detail links (numeric
 *      id slug at the tail of the path).
 *   3. Fall back to null when none of the above land — caller treats
 *      the missing value as "unknown".
 */
export async function countProfileListings(url: string): Promise<number | null> {
  if (!/^https?:\/\//i.test(url)) return null
  let html: string
  try {
    html = await fetchHtml(url)
  } catch {
    return null
  }
  return parseProfileListingCount(html)
}

/** Pure parser — exposed so we can unit-test the count extraction. */
export function parseProfileListingCount(html: string): number | null {
  const $ = cheerio.load(html)
  const text = $("body").text().replace(/\s+/g, " ")

  // Strategy 1 — explicit totals printed by the portal.
  // Common CR/ES patterns:
  //   "Mostrando 1-20 de 47"   → 47
  //   "Mostrando 1 - 20 de 47" → 47
  //   "47 resultados"          → 47
  //   "47 anuncios"            → 47
  //   "47 propiedades"         → 47
  //   "47 inmuebles"           → 47
  const patterns = [
    /\bde\s+(\d{1,5})\s+(resultados|anuncios|propiedades|inmuebles|publicaciones)\b/i,
    /\bMostrando\s+\d+(?:\s*[-–]\s*\d+)?\s+de\s+(\d{1,5})\b/i,
    /\b(\d{1,5})\s+(?:resultados|anuncios|propiedades|inmuebles|publicaciones)\b/i,
    /\b(\d{1,5})\s+listados?\b/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m && m[1]) {
      const n = parseInt(m[1], 10)
      if (Number.isFinite(n) && n >= 0 && n <= 5000) return n
    }
  }

  // Strategy 2 — count anchors that look like listing detail links.
  // encuentra24 detail URLs end with `/<numeric-id>` or `/id-<digits>`.
  // We collect unique hrefs so a card linked twice (image + title)
  // counts once.
  const detailHrefs = new Set<string>()
  $("a").each((_, el) => {
    const href = $(el).attr("href") ?? ""
    if (/\/[0-9]{6,}\/?$/.test(href) || /\/id-\d+\/?$/.test(href)) {
      detailHrefs.add(href.split("?")[0])
    }
  })
  if (detailHrefs.size > 0) return detailHrefs.size

  return null
}

// ── Helpers ─────────────────────────────────────────────────────────
function cleanName(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/^[ .,'-]+|[ .,'-]+$/g, "")
    .trim()
}

/** True when the href looks like an advertiser/agent profile path.
 *  Broad on purpose — portals change slugs across deploys, and false
 *  positives are cheap (we re-validate the page when we count). */
function isProfileHref(href: string): boolean {
  if (!href) return false
  // Negative: nav, search, listing detail. Filter these out first
  // so a generic `/search?u=...` doesn't get treated as a profile.
  if (/^(\/|https?:\/\/[^/]+\/)(search|busqueda|api|_next|static|images|img|assets|favicon)\b/i.test(href)) {
    return false
  }
  return /\/(anunciante|anunciantes|agente|agentes|perfil|profile|vendedor|vendedores|inmobiliaria|inmobiliarias|usuario|user|broker|company|empresa|publisher|publicador|account|cuenta|realtor|realtors|listings-by|todos-anuncios|all-listings|u|store|tienda|seller)\b/i.test(href)
}

/** Resolve an href against a base URL. Falls back to the raw href so
 *  the caller always gets a non-null string they can dedup against. */
function absUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString()
  } catch {
    return href
  }
}
