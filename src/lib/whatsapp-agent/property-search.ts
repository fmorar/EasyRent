import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Database } from "@/types/supabase"

type ListingType  = Database["public"]["Enums"]["listing_type"]
type PropertyType = Database["public"]["Enums"]["property_type"]
type Marketplace  = Database["public"]["Views"]["v_marketplace"]["Row"]

/**
 * Filter shape the agent sends to `search_properties`.
 *
 * `free_text` triggers a tier-2 LLM re-rank when present and we have
 * <15 strict matches — same pattern the marketplace page uses, but
 * pulled into a dedicated function so the agent can call it without
 * dragging in the marketplace page's full search pipeline.
 */
export interface AgentSearchInput {
  listing_type?:  ListingType
  property_type?: PropertyType
  min_bedrooms?:  number
  max_bedrooms?:  number
  min_price?:     number
  max_price?:     number
  currency?:      "USD" | "CRC"
  /** Free-form zones the lead mentioned. We OR-match against
   *  `display_address` ILIKE — good enough for "Escazú", "Santa Ana",
   *  "Heredia centro", etc. Costa Rican addresses are
   *  zone-of-canton-heavy, so this works without fuzzy search. */
  zones?:         string[]
  furnished?:     boolean
  /** Used as a hint for LLM re-ranking when present. */
  free_text?:     string
  limit?:         number
}

/**
 * What we hand BACK to the agent for each match. Deliberately narrow:
 *   • no owner / created_by / contact info
 *   • no exact lat/lng
 *   • no internal flags (is_marketplace_visible, deleted_at)
 * If the model "sees" something here, it's safe to mention to the
 * lead. The detail tool (`get_property_details`) returns slightly
 * more (description, amenities) but still allowlisted.
 */
export interface AgentSearchResult {
  id:             string
  slug:           string
  title:          string
  price:          number | null
  currency:       string | null
  listing_type:   ListingType | null
  property_type:  PropertyType | null
  status:         Database["public"]["Enums"]["property_status"] | null
  bedrooms:       number | null
  bathrooms:      number | null
  area_sqm:       number | null
  display_address: string | null
  /** Absolute URL — pre-built so the agent doesn't have to assemble it. */
  url:            string
}

const DEFAULT_LIMIT = 6
const MAX_LIMIT     = 10

/**
 * Property search for the WhatsApp agent.
 *
 * Three-stage pipeline (same logic as the marketplace page, factored
 * out so the agent can reuse it):
 *
 *   Tier 1 (strict) — every filter applied. ALWAYS runs.
 *   Tier 2 (broad)  — drops soft filters (free_text, zones, price
 *                     band). Runs ONLY when T1 returns < 3 matches,
 *                     since the agent caps presentations at 3
 *                     anyway.
 *   Tier 3 (LLM rank) — when free_text is set AND T1+T2 combined is
 *                       still thin, ask gpt-4o-mini to re-rank a
 *                       candidate pool semantically. Same
 *                       `rankPropertiesByRelevance` the marketplace
 *                       already uses.
 *
 * Always returns ≤ `limit` rows. Sorted by relevance (strict matches
 * first, then broad, then LLM-picks).
 */
export async function searchPropertiesForAgent(
  input: AgentSearchInput,
): Promise<AgentSearchResult[]> {
  const admin = createAdminClient()
  const cap   = Math.min(input.limit ?? DEFAULT_LIMIT, MAX_LIMIT)

  // Tier 1 — strict.
  const t1 = await runQuery(admin, input, "strict")

  // Skip broader tiers if we already have enough.
  let combined = dedupe(t1)
  const t1Count = combined.length
  let t2Count   = 0
  if (combined.length < 3) {
    const t2 = await runQuery(admin, input, "broad")
    t2Count = t2.length
    combined = dedupe([...combined, ...t2])
  }

  // Observability — when leads complain "but you have X in the
  // catalog!" we need to see which filter knocked it out. The args
  // line is the smallest thing we can log that lets us replay.
  console.log(
    `[whatsapp-agent.search] args=${JSON.stringify(input)} t1=${t1Count} t2=${t2Count} combined=${combined.length}`,
  )

  // Tier 3 — LLM re-rank when free_text is present and results are
  // still thin. We keep the candidate pool to T1+T2 instead of
  // re-querying the whole marketplace; the agent's filters already
  // narrowed the relevant universe.
  if (input.free_text && combined.length < cap && combined.length > 0) {
    try {
      const { rankPropertiesByRelevance } = await import("@/lib/ai/search-fallback")
      const ranked = await rankPropertiesByRelevance(
        input.free_text,
        combined.map((p) => ({
          id:              p.id ?? "",
          title:           p.title ?? "",
          description:     null,
          listing_type:    p.listing_type ?? null,
          property_type:   p.property_type ?? null,
          price:           p.price == null ? null : Number(p.price),
          currency:        p.currency ?? null,
          bedrooms:        p.bedrooms ?? null,
          bathrooms:       p.bathrooms ?? null,
          area_sqm:        p.area_sqm  ?? null,
          display_address: p.display_address ?? null,
        })),
        cap,
      )
      if (ranked?.ids?.length) {
        // Reorder by the LLM's ranking; drop anything it didn't pick.
        const byId = new Map(combined.map((p) => [p.id, p]))
        combined = ranked.ids.map((id) => byId.get(id)).filter((p): p is Marketplace => !!p)
      }
    } catch (err) {
      // LLM rerank is a nicety, not load-bearing. Fall through with
      // the rule-based ordering when it fails.
      console.warn("[whatsapp-agent.search] LLM rerank failed, using strict order", err)
    }
  }

  return combined.slice(0, cap).map(toAgentResult)
}

/**
 * Slim version of `getPropertyDetailsForAgent` — single query against
 * `v_marketplace`, no photos / amenities / description.
 *
 * Designed for the "lead arrived via the property contact button"
 * flow: we pre-resolve the property and inject it into the agent's
 * prompt context so the very first reply can reference price + zone
 * naturally instead of asking "¿qué buscás?" against an obvious URL.
 *
 * One round-trip vs three on the full detail helper — cheap enough
 * to run on every webhook turn that mentions a slug.
 */
export async function getPropertySummaryForAgent(slug: string): Promise<AgentSearchResult | null> {
  const admin = createAdminClient()
  const res = await admin
    .from("v_marketplace")
    .select("id, slug, title, price, currency, listing_type, property_type, status, bedrooms, bathrooms, area_sqm, display_address")
    .eq("slug", slug)
    .maybeSingle()
  if (res.error || !res.data) return null
  return toAgentResult(res.data as Marketplace)
}

/**
 * Resolve a single property by slug. Mirrors the public `/p/[slug]`
 * page query — minimal columns the agent needs to answer follow-up
 * questions.
 *
 * What we do NOT return (and why):
 *   • `photos` — WhatsApp doesn't render Markdown images and the model
 *     was happily pasting `![Imagen](supabase-url)` into bodies. Some
 *     of those messages were silently rejected by Twilio's WhatsApp
 *     gateway (multi-URL spam / unsupported media-in-body), breaking
 *     the conversation. If the lead wants to see photos they click
 *     the property URL.
 *   • `amenities` (full list) — bloats the prompt, and the lead can
 *     see them on the page. We trim to the top 6 strings for a
 *     "highlights" feel; that's enough for the agent to mention
 *     "tiene piscina y BBQ" without dumping a wall of bullets.
 */
const AMENITIES_HIGHLIGHT_LIMIT = 6

export async function getPropertyDetailsForAgent(slug: string): Promise<
  | (AgentSearchResult & {
      description: string | null
      amenities:   string[]
    })
  | null
> {
  const admin = createAdminClient()
  const baseRes = await admin
    .from("v_marketplace")
    .select("id, slug, title, price, currency, listing_type, property_type, status, bedrooms, bathrooms, area_sqm, display_address, description")
    .eq("slug", slug)
    .maybeSingle()
  if (baseRes.error || !baseRes.data) return null
  const base = baseRes.data as Marketplace & { description: string | null }

  const propRes = await admin
    .from("properties")
    .select("amenities")
    .eq("id", base.id!)
    .maybeSingle()

  return {
    ...toAgentResult(base),
    description: stripHtml(base.description),
    amenities:   (propRes.data?.amenities ?? []).slice(0, AMENITIES_HIGHLIGHT_LIMIT),
  }
}

// ── Internals ──────────────────────────────────────────────────────

type AdminClient = ReturnType<typeof createAdminClient>

async function runQuery(
  admin: AdminClient,
  input: AgentSearchInput,
  tier:  "strict" | "broad",
): Promise<Marketplace[]> {
  let q = admin
    .from("v_marketplace")
    .select("*")
    // available only — never recommend sold/reserved/off-market on
    // the agent surface, even if v_marketplace would technically
    // surface them. Detail page handles closed-listing messaging.
    .eq("status", "available" as never)

  // Hard filters — kept on both tiers. These represent strong intent
  // the lead expressed explicitly:
  //   • listing_type (rent vs sale) — almost always implicit from
  //     where they entered the funnel; getting it wrong wastes the turn.
  //   • property_type (apartment vs house vs land) — a "lote en Escazú"
  //     search should never return apartments.
  // Everything else (including `furnished`) is soft — leads are often
  // flexible, especially when the catalog is small. Treating
  // `furnished` as hard meant a lead who landed on a furnished
  // listing got zero results when they asked "y sin muebles?", because
  // the model carried over `furnished:true` and even the broad tier
  // kept that filter alive.
  if (input.listing_type)  q = q.eq("listing_type",  input.listing_type as never)
  if (input.property_type) q = q.eq("property_type", input.property_type as never)

  // Soft filters — dropped on the broad tier so we can offer
  // alternatives when the strict tier doesn't have enough matches.
  if (tier === "strict") {
    if (input.furnished === true)   q = q.eq("is_furnished", true)
    if (input.furnished === false)  q = q.eq("is_furnished", false)
    if (input.min_bedrooms != null) q = q.gte("bedrooms", input.min_bedrooms)
    if (input.max_bedrooms != null) q = q.lte("bedrooms", input.max_bedrooms)
    if (input.min_price    != null) q = q.gte("price",    input.min_price)
    if (input.max_price    != null) q = q.lte("price",    input.max_price)
    if (input.currency)             q = q.eq("currency",  input.currency)
    if (input.zones && input.zones.length > 0) {
      // OR across zones; ILIKE against display_address. We escape the
      // ILIKE wildcards because the agent passes free-form strings.
      const ors = input.zones
        .map((z) => `display_address.ilike.%${escapeILike(z)}%`)
        .join(",")
      q = q.or(ors)
    }
  }

  const res = await q
    .order("is_featured",  { ascending: false })
    .order("created_at",   { ascending: false })
    .limit(20)

  if (res.error) {
    console.warn(`[whatsapp-agent.search] ${tier} query failed`, res.error.message)
    return []
  }
  return (res.data ?? []) as Marketplace[]
}

function dedupe(rows: Marketplace[]): Marketplace[] {
  const seen = new Set<string>()
  const out: Marketplace[] = []
  for (const r of rows) {
    if (!r.id || seen.has(r.id)) continue
    seen.add(r.id)
    out.push(r)
  }
  return out
}

function toAgentResult(p: Marketplace): AgentSearchResult {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://www.easyrent.house"
  )
  return {
    id:              p.id ?? "",
    slug:            p.slug ?? "",
    title:           p.title ?? "Sin título",
    price:           p.price == null ? null : Number(p.price),
    currency:        p.currency,
    listing_type:    p.listing_type,
    property_type:   p.property_type,
    status:          p.status,
    bedrooms:        p.bedrooms,
    bathrooms:       p.bathrooms,
    area_sqm:        p.area_sqm,
    display_address: p.display_address,
    // ES URL by default — the WhatsApp concierge serves Costa Rican
    // visitors. Localizing the link based on the lead's language is a
    // later-phase concern.
    url:             p.slug ? `${base}/es/p/${p.slug}` : base,
  }
}

function stripHtml(s: string | null | undefined): string | null {
  if (!s) return null
  return s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() || null
}

function escapeILike(raw: string): string {
  // PostgREST `.or()` is comma-separated; commas inside the value
  // would corrupt the expression. We strip them along with the
  // wildcard chars to keep this safe + simple.
  return raw.replace(/[,%_]/g, " ").trim()
}
