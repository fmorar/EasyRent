// Marketplace page — search-pure.
//
// The marketing sections (CTA, FAQ, BigBand) have moved to the
// landing page (`/`) so this surface stays focused on filtering and
// browsing. Visitors who land here via bookmarks or direct links
// get straight to the search experience.

import { createClient } from "@/lib/supabase/server"
import { getLocale, getTranslations } from "next-intl/server"
import { MarketplaceCard } from "@/components/property/marketplace-card"
import { MarketplaceFilterBar } from "@/components/marketplace/filter-bar"
import { MarketplacePagination } from "@/components/marketplace/pagination"
import { PublicFooter } from "@/components/layout/public-footer"
import { rankPropertiesByRelevance } from "@/lib/ai/search-fallback"
import { buildHreflangAlternates } from "@/lib/seo/json-ld"
import type { Metadata } from "next"
import type { MarketplaceProperty } from "@/types"

export const revalidate = 60

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  ?? "https://www.easyrent.house"
)

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const title  = locale === "en"
    ? "Marketplace · Properties for rent & sale in Costa Rica · easyrent"
    : "Marketplace · Propiedades en alquiler y venta en Costa Rica · easyrent"
  const description = locale === "en"
    ? "Search apartments, houses, offices, and land across Costa Rica. Filter by price, bedrooms, location, and operation type."
    : "Buscá apartamentos, casas, oficinas y terrenos en Costa Rica. Filtrá por precio, habitaciones, zona y tipo de operación."

  return {
    title,
    description,
    alternates: buildHreflangAlternates({
      path:    "/marketplace",
      locale,
      baseUrl: SITE_URL,
    }),
    openGraph: {
      type:        "website",
      title,
      description,
      url:         `${SITE_URL}/${locale}/marketplace`,
      siteName:    "easyrent",
      locale:      locale === "en" ? "en_US" : "es_CR",
    },
    twitter: {
      card:        "summary_large_image",
      title,
      description,
    },
  }
}

interface SearchParams {
  q?:         string
  type?:      string
  /** "sale" | "rent" — filter by listing intent. */
  operation?: string
  /** "1" → only furnished. "0" → only unfurnished. omitted → either. */
  furnished?: string
  /** Minimum number of bedrooms ("1" | "2" | "3" | "4" | "5"). */
  bedrooms?:  string
  location?:  string
  price?:     string  // "min-max" or "min-" or "-max"
  page?:      string
}

const PER_PAGE = 9

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const supabase = await createClient()
  const sp       = await searchParams
  const t           = await getTranslations("marketplace.results")
  const tTypePlural = await getTranslations("properties.typesPlural")
  const tBanner     = await getTranslations("marketplace.tierBanners")

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1)

  // ── Augment-semantics search pipeline ──────────────────────────
  //
  // Three tiers run progressively when results are sparse:
  //
  //   Tier 1 (strict)   — all filters applied. Always runs.
  //   Tier 2 (broad)    — drops ALL soft filters (q, location, price,
  //                       bedrooms). Triggered when T1 < 10 results.
  //                       Combined with T1 (deduped).
  //   Tier 3 (LLM rank) — semantic similarity fallback. Triggered
  //                       when T1+T2 combined < 15. Adds new IDs.
  //
  // Combined results are sliced for pagination — strict matches
  // appear first, broad matches next, LLM picks last.
  type Tier = 1 | 2

  // Cap each SQL tier so combined results stay paginatable.
  const FETCH_CAP = 200

  const buildQuery = (tier: Tier) => {
    let q = supabase
      .from("v_marketplace")
      .select("*")

    // Soft text filters — only on tier 1
    if (tier === 1 && sp.q?.trim()) {
      const term = sp.q.trim().replace(/[%_]/g, "")
      q = q.or([
        `title.ilike.%${term}%`,
        `display_address.ilike.%${term}%`,
        `description.ilike.%${term}%`,
      ].join(","))
    }
    if (tier === 1 && sp.location) {
      const loc = sp.location.replace(/[%_]/g, "")
      q = q.or([
        `display_address.ilike.%${loc}%`,
        `title.ilike.%${loc}%`,
        `description.ilike.%${loc}%`,
      ].join(","))
    }

    // Range filters — only on tier 1 (broad tier drops these too)
    if (tier === 1 && sp.bedrooms) {
      const min = Number(sp.bedrooms)
      if (Number.isFinite(min) && min > 0) q = q.gte("bedrooms", min)
    }
    if (tier === 1 && sp.price) {
      const [minStr, maxStr] = sp.price.split("-")
      const min = minStr ? Number(minStr) : null
      const max = maxStr ? Number(maxStr) : null
      if (min != null && !isNaN(min)) q = q.gte("price", min)
      if (max != null && !isNaN(max)) q = q.lte("price", max)
    }

    // Hard filters — kept on both tiers (these reflect the user's
    // explicit chip choices that we shouldn't override)
    if (sp.type) {
      q = q.eq("property_type", sp.type as "apartment" | "house" | "land" | "commercial" | "office" | "warehouse")
    }
    if (sp.operation === "sale" || sp.operation === "rent") {
      q = q.eq("listing_type", sp.operation)
    }
    if (sp.furnished === "1") q = q.eq("is_furnished", true)
    else if (sp.furnished === "0") q = q.eq("is_furnished", false)

    return q
      .order("is_featured", { ascending: false })
      .order("created_at",  { ascending: false })
      .limit(FETCH_CAP)
  }

  const hasSoftFilter = !!(sp.q?.trim() || sp.location || sp.price || sp.bedrooms)

  // ── Tier 1 — always ────────────────────────────────────────────
  const t1 = await buildQuery(1) as { data: MarketplaceProperty[] | null }
  const combined: MarketplaceProperty[] = (t1.data ?? []).slice()
  const seen = new Set(combined.map((p) => p.id))
  let strictCount    = combined.length
  let broadAdded     = 0
  let llmAdded       = 0
  let llmReasoning: string | null = null

  // ── Tier 2 — augment when T1 < 10 ──────────────────────────────
  if (combined.length < 10 && hasSoftFilter) {
    const t2 = await buildQuery(2) as { data: MarketplaceProperty[] | null }
    for (const p of t2.data ?? []) {
      if (!seen.has(p.id)) {
        combined.push(p)
        seen.add(p.id)
        broadAdded++
      }
    }
  }

  // ── Tier 3 — LLM rank when combined < 15 ───────────────────────
  if (combined.length < 15) {
    const MAX_LLM_CANDIDATES = 120

    async function fetchCandidates(opts: {
      operation?: "sale" | "rent"
      type?:      "apartment" | "house" | "land" | "commercial" | "office" | "warehouse"
    }): Promise<MarketplaceProperty[] | null> {
      let q = supabase.from("v_marketplace").select("*")
      if (opts.operation) q = q.eq("listing_type",  opts.operation)
      if (opts.type)      q = q.eq("property_type", opts.type)
      const { data } = await q
        .order("is_featured", { ascending: false })
        .order("created_at",  { ascending: false })
        .limit(MAX_LLM_CANDIDATES) as { data: MarketplaceProperty[] | null }
      return data
    }

    const wantedOp   = sp.operation === "sale" || sp.operation === "rent" ? sp.operation : undefined
    const wantedType = sp.type as
      | "apartment" | "house" | "land" | "commercial" | "office" | "warehouse"
      | undefined

    // Smart candidate selection — narrow set first, broaden if empty.
    let pool = await fetchCandidates({ operation: wantedOp, type: wantedType })
    if (!pool || pool.length === 0) {
      pool = await fetchCandidates({ operation: wantedOp })
    }
    if (!pool || pool.length === 0) {
      pool = await fetchCandidates({})
    }

    // Exclude properties we already have so the LLM only adds NEW IDs.
    const llmCandidates = (pool ?? []).filter((p) => !seen.has(p.id))

    if (llmCandidates.length > 0) {
      const queryText = sp.q?.trim() ?? [
        sp.type      && `${sp.type}`,
        sp.operation === "rent" ? "en alquiler" : sp.operation === "sale" ? "en venta" : null,
        sp.location  && `en ${sp.location}`,
        sp.bedrooms  && `${sp.bedrooms} habitaciones`,
        sp.furnished === "1" && "amueblado",
      ].filter(Boolean).join(" ")

      if (queryText) {
        const ranked = await rankPropertiesByRelevance(
          queryText,
          llmCandidates.map((p) => ({
            id:              p.id ?? "",
            title:           p.title,
            description:     p.description,
            property_type:   p.property_type,
            listing_type:    p.listing_type,
            display_address: p.display_address,
            bedrooms:        p.bedrooms,
            bathrooms:       p.bathrooms,
            area_sqm:        p.area_sqm,
            price:           p.price,
            currency:        p.currency,
          })),
        )

        if (ranked && ranked.ids.length > 0) {
          const byId = new Map(llmCandidates.map((p) => [p.id, p]))
          for (const id of ranked.ids) {
            const p = byId.get(id)
            if (p && !seen.has(p.id)) {
              combined.push(p)
              seen.add(p.id)
              llmAdded++
            }
          }
          llmReasoning = ranked.reasoning
        }
      }
    }
  }

  // ── Pagination on the combined list ────────────────────────────
  const totalCount = combined.length
  const properties = combined.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const count      = totalCount

  // Which tier mix did we serve? Used to render the right banner.
  const tierMix: "strict" | "with-broad" | "with-llm" =
    llmAdded   > 0 ? "with-llm"
    : broadAdded > 0 ? "with-broad"
    : "strict"

  // Only signal augmentation when we actually had to broaden — strict
  // mode means everything in the grid matched the user's exact filters.
  void strictCount

  // ── Cover photos for each (one extra round-trip; cached by the page) ──
  let coverByProperty: Record<string, string> = {}
  if (properties && properties.length > 0) {
    const ids = properties.map((p) => p.id!).filter(Boolean)
    const { data: photos } = await supabase
      .from("property_photos")
      .select("property_id, url, is_cover, order_index")
      .in("property_id", ids)
      .order("order_index", { ascending: true })

    if (photos) {
      // Pick cover (or first) per property
      const grouped = new Map<string, { url: string; is_cover: boolean; order_index: number }[]>()
      for (const ph of photos) {
        const arr = grouped.get(ph.property_id) ?? []
        arr.push(ph as { url: string; is_cover: boolean; order_index: number })
        grouped.set(ph.property_id, arr)
      }
      grouped.forEach((arr, pid) => {
        const cover = arr.find((p) => p.is_cover) ?? arr[0]
        if (cover) coverByProperty[pid] = cover.url
      })
    }
  }

  // ── Distinct locations for the filter dropdown ─────────────────
  const { data: locRows } = await supabase
    .from("v_marketplace")
    .select("display_address")
    .not("display_address", "is", null)
    .limit(500)

  const locations = Array.from(
    new Set(
      (locRows ?? [])
        .map((r) => (r as { display_address: string | null }).display_address ?? "")
        .filter(Boolean)
        .map((addr) => {
          // Take last 2 components for a friendlier dropdown ("San José, Costa Rica")
          const parts = addr.split(",").map((p) => p.trim()).filter(Boolean)
          return parts.slice(-2).join(", ")
        })
    )
  ).sort().slice(0, 30)

  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE))

  // Title segment — concrete to anchor information scent
  const titleParts: string[] = []
  if (sp.type)     titleParts.push(formatType(sp.type, tTypePlural))
  else             titleParts.push(t("headlineFallback"))
  if (sp.operation === "rent")      titleParts.push(t("headlineRent"))
  else if (sp.operation === "sale") titleParts.push(t("headlineSale"))
  if (sp.furnished === "1")         titleParts.push(t("headlineFurnished"))
  if (sp.bedrooms) {
    const n = Number(sp.bedrooms)
    titleParts.push(t(n === 1 ? "headlineBedroomsOne" : "headlineBedroomsMany", { n }))
  }
  if (sp.location)                  titleParts.push(t("headlineLocation", { location: sp.location }))
  const headerTitle = titleParts.join(" ")

  return (
    <div className="bg-background">

      {/* ── Filter bar (full-bleed tinted band) ─────────────── */}
      {/* Tint the band so it reads as a control surface, not page chrome.
          The bar itself stays inside the page gutter. */}
      <div className="bg-muted/30 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-(--spacing-block) sm:py-(--spacing-section)">
          <MarketplaceFilterBar locations={locations} />
        </div>
      </div>

      {/* ── Results header — same gutter as the filter bar above and
              the grid below so the page reads as one continuous column. */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-(--spacing-section) md:mt-(--spacing-major) mb-(--spacing-block) flex items-end justify-between gap-(--spacing-cluster) flex-wrap">
        <div className="space-y-(--spacing-tight)">
          <h1
            className="font-heading font-bold tracking-tight leading-[1.05]"
            style={{ fontSize: "clamp(1.5rem, 3.5vw, 2.5rem)" }}
          >
            {headerTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            {totalCount === 0
              ? t("noResults")
              : t(totalCount === 1 ? "foundOne" : "foundMany", { count: totalCount })}
          </p>
        </div>
      </div>

      {/* ── Augment banner — aligned with the same 7xl gutter. */}
      {tierMix !== "strict" && totalCount > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-(--spacing-block)">
          <div
            className={
              tierMix === "with-llm"
                ? "rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm flex items-start gap-3"
                : "rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm flex items-start gap-3"
            }
          >
            {tierMix === "with-llm" ? (
              <svg className="h-4 w-4 text-foreground shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2zm6 12l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
              </svg>
            ) : (
              <span className="h-2 w-2 rounded-full bg-warning mt-1.5 shrink-0" />
            )}
            <div className="flex-1">
              <p className={
                tierMix === "with-llm"
                  ? "font-medium text-foreground"
                  : "font-medium text-foreground"
              }>
                {tierMix === "with-broad" ? tBanner("broadHeadline") : tBanner("llmHeadline")}
              </p>
              <p className={
                "text-xs mt-0.5 " +
                (tierMix === "with-llm" ? "text-muted-foreground" : "text-foreground/70")
              }>
                {tierMix === "with-broad"
                  ? tBanner("broadBody")
                  : (llmReasoning || tBanner("llmFallback"))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Grid (wide — primary content) ───────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {!properties || properties.length === 0 ? (
          // Empty state — narrower than grid; subtle fade-in.
          <div className="max-w-2xl mx-auto text-center py-16 sm:py-20 border rounded-2xl space-y-3 animate-in fade-in duration-(--duration-state) ease-(--ease-out-quart)">
            <p className="text-base font-heading font-semibold">{t("noResultsHeadline")}</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {t("noResultsBody")}
            </p>
            <div className="pt-2">
              <a
                href="/marketplace"
                className="inline-flex items-center justify-center h-9 px-4 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-[background-color] duration-(--duration-state) ease-(--ease-out-quart)"
              >
                {t("clearFilters")}
              </a>
            </div>
          </div>
        ) : (
          // Symmetric gap (was gap-x-6 gap-y-10 — asymmetric created
          // cramped mobile, airy desktop).
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-(--spacing-block) sm:gap-(--spacing-section)">
            {properties.map((p) => (
              <MarketplaceCard
                key={p.id}
                property={p}
                coverUrl={coverByProperty[p.id!]}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        <div className="mt-(--spacing-section) mb-(--spacing-major)">
          <MarketplacePagination currentPage={page} totalPages={totalPages} />
        </div>
      </div>

      {/* Public footer — newsletter band + giant wordmark + legal row.
          The wordmark uses the first visible property's cover as its
          backdrop, falling back to the editorial band when there are
          no results on the current page. */}
      <PublicFooter
        wordmarkPhotoUrl={
          properties && properties.length > 0
            ? coverByProperty[properties[0].id!] ?? null
            : null
        }
      />
    </div>
  )
}

// Type label helper for the headline — uses the explicit plural key
// from `properties.typesPlural.*` so we don't try to pluralise on the fly.
function formatType(
  type: string,
  tTypePlural: (key: "apartment" | "house" | "land" | "commercial" | "office" | "warehouse") => string,
): string {
  return tTypePlural(type as "apartment" | "house" | "land" | "commercial" | "office" | "warehouse")
}
