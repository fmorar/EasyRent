// Server-only helper: find marketplace listings similar to a subject
// property. Used at the bottom of `/p/[slug]` to keep visitors moving
// when the current listing isn't quite right.
//
// Similarity is intentionally simple (no embeddings, no LLM) — we
// score candidates in JS by listing intent, property type, location,
// price proximity, and bedroom count. Plenty for a public-page rec.

import "server-only"
import { createClient } from "@/lib/supabase/server"
import type { MarketplaceProperty } from "@/types"

interface Subject {
  id:               string
  listing_type:     string | null
  /** May be null on legacy rows; we skip same-type filtering then. */
  property_type:    string | null
  price:            number | null
  currency:         string | null
  bedrooms:         number | null
  display_address:  string | null
}

export interface SimilarPropertiesResult {
  properties:      MarketplaceProperty[]
  /** Map of property.id → cover photo URL. Same shape as the
   *  marketplace page uses, so consumers can pass it straight to
   *  `<MarketplaceCard coverUrl={...}>`. */
  coverByProperty: Record<string, string>
  /** Map of property.id → ordered photo list (cover first). Powers
   *  the mobile swipe carousel inside each listing card. */
  photosByProperty: Record<string, Array<{ url: string; caption?: string | null }>>
}

const CANDIDATE_POOL = 30

/**
 * Pull up to `limit` similar listings for the given subject.
 * Returns an empty result on edge cases (no candidates, query error)
 * — the page should treat the absence as "skip the section".
 */
export async function getSimilarProperties(
  subject: Subject, limit = 6,
): Promise<SimilarPropertiesResult> {
  const supabase = await createClient()

  // ── Tier 1: same listing_type + same property_type ───────────────
  // Most listings will fall here — that's the "right intent + right
  // shape" pool. We pull a fat candidate list (`CANDIDATE_POOL`) so
  // the JS scorer has room to pick the closest matches by zone and
  // price even when the absolute count is small.
  // Cast through `never` for the enum-typed `.eq()` calls — Supabase
  // narrows them to the column's union type, but we accept `string |
  // null` upstream and have already validated they're present.
  const subjectIntent = subject.listing_type ?? "sale"
  let pool: MarketplaceProperty[] | null = null
  if (subject.property_type) {
    const { data } = await supabase
      .from("v_marketplace")
      .select("*")
      .neq("id", subject.id)
      .eq("listing_type",  subjectIntent           as never)
      .eq("property_type", subject.property_type   as never)
      // v_marketplace includes sold/reserved (only off_market is
      // filtered). Limit similar suggestions to available listings
      // so the "Mirá estas opciones disponibles" promise isn't a lie.
      .eq("status",        "available"             as never)
      .order("created_at", { ascending: false })
      .limit(CANDIDATE_POOL) as { data: MarketplaceProperty[] | null }
    pool = data
  }

  // ── Tier 2 fallback: drop property_type ──────────────────────────
  // Sparse markets / less common types (warehouses, land) often have
  // <3 same-type listings. Backfill with same-intent candidates so
  // the section stays useful instead of empty.
  if (!pool || pool.length < limit) {
    const have = new Set((pool ?? []).map((p) => p.id))
    const { data: extra } = await supabase
      .from("v_marketplace")
      .select("*")
      .neq("id", subject.id)
      .eq("listing_type", subjectIntent as never)
      .eq("status",       "available"  as never)
      .order("created_at", { ascending: false })
      .limit(CANDIDATE_POOL) as { data: MarketplaceProperty[] | null }
    pool = [...(pool ?? []), ...((extra ?? []).filter((p) => p.id && !have.has(p.id)))]
  }

  if (!pool || pool.length === 0) {
    return { properties: [], coverByProperty: {}, photosByProperty: {} }
  }

  // ── Score + sort ─────────────────────────────────────────────────
  const subjectZone = lastZoneSegment(subject.display_address)
  const subjectPrice = subject.price != null ? Number(subject.price) : null

  const scored = pool
    .map((p) => ({ p, score: scoreCandidate(p, subject, subjectZone, subjectPrice) }))
    .sort((a, b) => b.score - a.score)

  const top = scored.slice(0, limit).map((x) => x.p)

  // ── Photo lists ─────────────────────────────────────────────────
  // Same pattern as the marketplace page — one round-trip, group by
  // property_id, sort cover first then by order_index. Yields both
  // the legacy single-cover map AND the full carousel list per
  // property so the mobile card can swipe.
  const ids = top.map((p) => p.id!).filter(Boolean)
  const coverByProperty:  Record<string, string> = {}
  const photosByProperty: Record<string, Array<{ url: string; caption?: string | null }>> = {}
  if (ids.length > 0) {
    const { data: photos } = await supabase
      .from("property_photos")
      .select("property_id, url, caption, is_cover, order_index")
      .in("property_id", ids)
      .order("order_index", { ascending: true })

    if (photos) {
      const grouped = new Map<string, { url: string; caption: string | null; is_cover: boolean; order_index: number }[]>()
      for (const ph of photos) {
        const arr = grouped.get(ph.property_id) ?? []
        arr.push(ph as { url: string; caption: string | null; is_cover: boolean; order_index: number })
        grouped.set(ph.property_id, arr)
      }
      grouped.forEach((arr, pid) => {
        const sorted = [...arr].sort((a, b) => {
          if (a.is_cover && !b.is_cover) return -1
          if (!a.is_cover && b.is_cover) return 1
          return a.order_index - b.order_index
        })
        if (sorted[0]) coverByProperty[pid] = sorted[0].url
        photosByProperty[pid] = sorted.map((p) => ({ url: p.url, caption: p.caption }))
      })
    }
  }

  return { properties: top, coverByProperty, photosByProperty }
}

// ── Scoring ─────────────────────────────────────────────────────────
// Higher score == closer to the subject. Weights are tuned so:
//   • Zone match dominates over price (a similar listing in the same
//     neighbourhood beats a slightly cheaper one across the GAM).
//   • Price proximity matters but degrades smoothly.
//   • Bedrooms gives a small nudge — agents care, browsers less so.
//   • Recency is a tiebreaker.
function scoreCandidate(
  p: MarketplaceProperty,
  subject: Subject,
  subjectZone: string | null,
  subjectPrice: number | null,
): number {
  let score = 0

  // Same listing intent (already filtered upstream, but if we fell
  // into the broader fallback this becomes a real signal).
  if (p.listing_type === subject.listing_type) score += 30

  // Same property type (same comment as above).
  if (p.property_type === subject.property_type) score += 25

  // Zone — last comma-segment of the address. Crude but works in CR
  // where addresses end with district/canton.
  if (subjectZone) {
    const candidateZone = lastZoneSegment(p.display_address)
    if (candidateZone && normalize(candidateZone) === normalize(subjectZone)) {
      score += 20
    }
  }

  // Price proximity — only when both have a price and currency matches.
  if (subjectPrice != null && p.price != null && p.currency === subject.currency) {
    const candidatePrice = Number(p.price)
    if (subjectPrice > 0) {
      const ratio = Math.abs(candidatePrice - subjectPrice) / subjectPrice
      // Smooth ramp: 0% off → +18, 30% off → +6, 60%+ → 0.
      if (ratio <= 0.6) score += Math.round(18 * (1 - ratio / 0.6))
    }
  }

  // Bedrooms — exact +10, ±1 +5.
  if (subject.bedrooms != null && p.bedrooms != null) {
    const diff = Math.abs(p.bedrooms - subject.bedrooms)
    if (diff === 0) score += 10
    else if (diff === 1) score += 5
  }

  // Recency tiebreaker — small bonus for newer listings (≤30 days).
  if (p.created_at) {
    const ageMs = Date.now() - new Date(p.created_at).getTime()
    const ageDays = ageMs / (1000 * 60 * 60 * 24)
    if (ageDays <= 30) score += 2
  }

  // Featured listings get a tiny preference at equal scores.
  if (p.is_featured) score += 1

  return score
}

function lastZoneSegment(address: string | null | undefined): string | null {
  if (!address) return null
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean)
  return parts.length === 0 ? null : parts[parts.length - 1]
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")  // strip diacritics
    .replace(/\s+/g, " ")
    .trim()
}
