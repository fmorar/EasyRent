import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { crawlSource } from "@/lib/market-analysis/crawler"
import { normalizeListing } from "@/lib/market-analysis/normalizers"
import { getUsdToCrcRate, convertPrice, roundUsd, roundCrc } from "@/lib/fx"
import type { Database } from "@/types/supabase"
import type { AgentSearchInput, AgentSearchResult } from "./property-search"

type ExternalInsert = Database["public"]["Tables"]["external_listings"]["Insert"]

/**
 * Encuentra24 fallback for the WhatsApp concierge.
 *
 * When `searchPropertiesForAgent` returns zero results across both
 * the strict and broad tiers, the agent's options are:
 *   a) tell the lead "no tengo nada" and lose the conversation, or
 *   b) check the cold market (Encuentra24 for now), surface what's
 *      out there, and offer to coordinate a contact.
 *
 * This module does (b). It is intentionally narrow:
 *   • One source (Encuentra24) — we'd add more adapters here later.
 *   • One page of results, no advertiser enrichment. Webhook latency
 *     budget is ~10s; the existing crawler already costs ~2-3s for a
 *     single-page sync scrape, so we stay under the wire.
 *   • Persist every result into `external_listings` so the dashboard
 *     and the agent's next turn can reference them, and so a future
 *     "claim this listing" workflow has rows to operate on.
 *
 * Re-scrape protection: if we already scraped the same URL in the
 * last hour, return the cached rows from the DB instead of hitting
 * Encuentra24 again. Saves their bandwidth + our latency.
 */

const RESCRAPE_TTL_MS = 60 * 60 * 1000  // 1h
const SOURCE_NAME     = "encuentra24"

/**
 * Public entry point. Mirrors `searchPropertiesForAgent`'s output
 * shape so the agent doesn't have to know it's working with external
 * data structurally — only the `is_external` + `source_url` flags
 * differ.
 */
export async function searchExternalPropertiesForAgent(
  input: AgentSearchInput,
): Promise<AgentSearchResult[]> {
  const url = composeEncuentra24Url(input)
  if (!url) return []

  const admin = createAdminClient()
  const cached = await readCachedExternals(admin, url)
  if (cached) {
    console.log(`[whatsapp-agent.external] cache hit url=${url} count=${cached.length}`)
    return projectExternalsToAgentShape(cached, input)
  }

  const crawl = await crawlSource(url, { scanDepth: 1, maxListings: 30 })
  if (crawl.error || crawl.listings.length === 0) {
    console.warn(
      `[whatsapp-agent.external] crawl returned 0 results url=${url} error=${crawl.error ?? "(none)"}`,
    )
    return []
  }

  const persisted = await upsertExternalListings(admin, url, crawl.listings)
  console.log(
    `[whatsapp-agent.external] scraped url=${url} got=${crawl.listings.length} persisted=${persisted.length}`,
  )
  return projectExternalsToAgentShape(persisted, input)
}

/**
 * Map agent filters → Encuentra24 search URL.
 *
 * E24 URL pattern:
 *   /costa-rica-es/bienes-raices-{alquiler|venta}-{apartamento|casa|lote|local|oficina}[/<location-slug>]
 *
 * We append the FIRST zone (E24 only supports one path segment, not
 * a list), and skip if the zone slug looks dodgy. No query string —
 * price filtering happens in JS after the scrape so we can apply our
 * own CRC↔USD conversion.
 *
 * Returns null when we don't have enough to compose anything sensible
 * — at minimum we need `listing_type`. The agent's prompt mandates
 * that filter, so this is rare.
 */
export function composeEncuentra24Url(input: AgentSearchInput): string | null {
  const operation = input.listing_type === "rent" ? "alquiler"
    : input.listing_type === "sale" ? "venta"
    : null
  if (!operation) return null

  const propType = E24_PROPERTY_TYPE[input.property_type ?? "apartment"] ?? "apartamento"

  const zoneSlug = pickFirstZoneSlug(input.zones)
  const base = `https://www.encuentra24.com/costa-rica-es/bienes-raices-${operation}-${propType}`
  return zoneSlug ? `${base}/${zoneSlug}` : base
}

/**
 * Normalize a free-text zone into the URL slug E24 expects. The
 * accent-stripping + lowercasing + hyphen-collapsing here matches the
 * conventions on E24's own location pages — "Escazú" → "escazu",
 * "Santa Ana" → "santa-ana", "San Rafael de Escazú" → "san-rafael-de-escazu".
 */
function pickFirstZoneSlug(zones: string[] | undefined): string | null {
  if (!zones || zones.length === 0) return null
  const raw = zones[0]?.trim()
  if (!raw) return null
  const slug = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")     // strip accents
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
  return slug.length >= 2 ? slug : null
}

const E24_PROPERTY_TYPE: Partial<Record<NonNullable<AgentSearchInput["property_type"]>, string>> = {
  apartment:  "apartamento",
  house:      "casa",
  land:       "lote",
  commercial: "local",
  office:     "oficina",
  warehouse:  "bodega",
}

// ── Cache lookup ─────────────────────────────────────────────────────

type AdminClient = ReturnType<typeof createAdminClient>

interface CachedExternalListing {
  id:            string
  source_name:   string
  source_url:    string
  title:         string
  description:   string | null
  price:         number | null
  currency:      string | null
  listing_type:  AgentSearchInput["listing_type"] | null
  property_type: AgentSearchInput["property_type"] | null
  bedrooms:      number | null
  bathrooms:     number | null
  area_sqm:      number | null
  location_text: string | null
  last_seen_at:  string
}

/** Return cached rows when we re-scraped recently enough. The cache
 *  lookup is by SEARCH URL (the listing-page we'd scrape), not by
 *  detail URL — i.e. "have we asked E24 for `/apartamento/escazu`
 *  within the last hour?". */
async function readCachedExternals(
  admin: AdminClient,
  searchUrl: string,
): Promise<CachedExternalListing[] | null> {
  // We store every result's `raw_extracted.search_url` so a single
  // SELECT scoped by that key gives the cohort the previous crawl produced.
  const cutoff = new Date(Date.now() - RESCRAPE_TTL_MS).toISOString()
  const res = await admin
    .from("external_listings")
    .select("id, source_name, source_url, title, description, price, currency, listing_type, property_type, bedrooms, bathrooms, area_sqm, location_text, last_seen_at")
    .eq("is_active", true)
    .eq("source_name", SOURCE_NAME)
    .contains("raw_extracted", { search_url: searchUrl })
    .gte("last_seen_at", cutoff)
    .order("last_seen_at", { ascending: false })
    .limit(30)
  if (res.error) {
    console.warn("[whatsapp-agent.external] cache read failed", res.error.message)
    return null
  }
  return (res.data as CachedExternalListing[] | null) ?? null
}

// ── Scrape persistence ────────────────────────────────────────────────

async function upsertExternalListings(
  admin:     AdminClient,
  searchUrl: string,
  rawList:   Awaited<ReturnType<typeof crawlSource>>["listings"],
): Promise<CachedExternalListing[]> {
  const normalized = rawList
    .map((c) => normalizeListing(c))
    // Need at least a detail URL to dedupe + a title to display.
    .filter((n) => !!n.listing_url && !!n.title)

  if (normalized.length === 0) return []

  // Build the upsert rows. We tag every one with the search_url that
  // produced them — used as the cache key on the next call. The
  // cast on `raw_extracted` collapses NormalizedListing into the
  // generated `Json` type (recursive union TS can't widen on its own).
  const rows: ExternalInsert[] = normalized.map((n) => ({
    source_name:    SOURCE_NAME,
    source_url:     n.listing_url!,
    title:          n.title!.slice(0, 280),
    description:    n.description?.slice(0, 1500) ?? null,
    price:          n.price        ?? null,
    currency:       n.currency     ?? null,
    listing_type:   mapListingType(n.operation_type)  ?? null,
    property_type:  mapPropertyType(n.property_type)  ?? null,
    bedrooms:       n.bedrooms     ?? null,
    bathrooms:      n.bathrooms    ?? null,
    area_sqm:       n.built_area_m2 ?? null,
    location_text:  n.location_text ?? null,
    raw_extracted:  { ...n, search_url: searchUrl } as ExternalInsert["raw_extracted"],
    last_seen_at:   new Date().toISOString(),
    is_active:      true,
  }))

  const upRes = await admin
    .from("external_listings")
    .upsert(rows, {
      onConflict:        "source_url",
      ignoreDuplicates:  false,   // we DO want updates: last_seen_at, prices, etc.
    })
    .select("id, source_name, source_url, title, description, price, currency, listing_type, property_type, bedrooms, bathrooms, area_sqm, location_text, last_seen_at")
  if (upRes.error) {
    console.warn("[whatsapp-agent.external] upsert failed", upRes.error.message)
    return []
  }
  return (upRes.data as CachedExternalListing[] | null) ?? []
}

function mapListingType(v: string | undefined): "rent" | "sale" | null {
  if (v === "rent" || v === "sale") return v
  return null
}
function mapPropertyType(v: string | undefined): NonNullable<AgentSearchInput["property_type"]> | null {
  if (!v) return null
  // The normalizer outputs lowercase English keywords. Map to our enum.
  if (v === "apartment" || v === "apartamento") return "apartment"
  if (v === "house"     || v === "casa")        return "house"
  if (v === "land"      || v === "lote")        return "land"
  if (v === "commercial" || v === "local")      return "commercial"
  if (v === "office"    || v === "oficina")     return "office"
  if (v === "warehouse" || v === "bodega")      return "warehouse"
  return null
}

// ── Projection to AgentSearchResult shape ────────────────────────────

/**
 * Convert persisted externals into the shape the agent's tool already
 * understands. Two extra fields slip in via the result projection:
 *   • `is_external: true`  → the agent uses this to switch its tone
 *     (transparency rule in the prompt).
 *   • `url`                → the source URL (Encuentra24's detail
 *     page), not our own /p/<slug>. The agent passes this straight
 *     to the lead.
 *
 * Also applies the same JS-side price filter that the internal search
 * uses, with CRC↔USD conversion at current FX. We don't trust the
 * scraper's filtering — a CRC listing within a USD budget should
 * still surface.
 */
async function projectExternalsToAgentShape(
  rows:  CachedExternalListing[],
  input: AgentSearchInput,
): Promise<AgentSearchResult[]> {
  const { usdToCrc } = await getUsdToCrcRate()
  const userCcy = (input.currency ?? "USD").toUpperCase()

  return rows
    .filter((r) => {
      // Hard filters the agent passed — listing_type / property_type
      // / bedrooms — apply here too (the search URL may have been
      // composed without all of them).
      if (input.listing_type && r.listing_type && r.listing_type !== input.listing_type) return false
      if (input.property_type && r.property_type && r.property_type !== input.property_type) return false
      if (input.min_bedrooms != null && r.bedrooms != null && r.bedrooms < input.min_bedrooms) return false
      if (input.max_bedrooms != null && r.bedrooms != null && r.bedrooms > input.max_bedrooms) return false
      // Price filter w/ FX conversion. Skip listings with unknown
      // price — we can't safely match against the budget, and the
      // lead would have to ask the seller anyway.
      if (input.min_price != null || input.max_price != null) {
        if (r.price == null) return false
        const priceInUserCcy = convertPrice(
          Number(r.price),
          r.currency,
          userCcy,
          usdToCrc,
        )
        if (input.min_price != null && priceInUserCcy < input.min_price) return false
        if (input.max_price != null && priceInUserCcy > input.max_price) return false
      }
      return true
    })
    .slice(0, Math.min(input.limit ?? 5, 5))
    .map((r) => {
      const priceNum = r.price == null ? null : Number(r.price)
      let priceUsd: number | null = null
      let priceCrc: number | null = null
      if (priceNum != null) {
        if (r.currency === "USD") {
          priceUsd = roundUsd(priceNum)
          priceCrc = roundCrc(priceNum * usdToCrc)
        } else if (r.currency === "CRC") {
          priceCrc = roundCrc(priceNum)
          priceUsd = roundUsd(priceNum / usdToCrc)
        }
      }
      return {
        id:              r.id,
        slug:            "",                          // externals have no slug — they're not in v_marketplace
        title:           r.title,
        price:           priceNum,
        currency:        r.currency,
        price_in_usd:    priceUsd,
        price_in_crc:    priceCrc,
        listing_type:    r.listing_type,
        property_type:   r.property_type,
        status:          null,
        bedrooms:        r.bedrooms,
        bathrooms:       r.bathrooms,
        area_sqm:        r.area_sqm,
        display_address: r.location_text,
        url:             r.source_url,                // points to E24 detail page
        // Extra field — declared via intersection at the call site
        // (the tool layer surfaces this to the model).
        is_external:     true,
        external_source: SOURCE_NAME,
      } as AgentSearchResult & { is_external: true; external_source: string }
    })
}
