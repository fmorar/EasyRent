"use server"

import { requireAdmin } from "@/lib/auth"
import { crawlSource } from "@/lib/market-analysis/crawler"
import { classifyOwner, type OwnerClassification } from "@/lib/owner-classifier"
import { enrichListingsWithAdvertiser } from "@/lib/owner-prospector-enrich"
import type { ActionResult } from "@/types"

export interface OwnerProspect {
  /** The original listing URL on the source portal. Where the admin
   *  clicks through to call / write. */
  listing_url: string | null
  source_name: string | null
  title:       string | null
  price_text:  string | null
  currency:    string | null
  location:    string | null
  /** Free-text we used to classify — surfaced in the UI as a tooltip
   *  so the admin can see what the model saw. Truncated. */
  excerpt:     string | null
  /** Advertiser pulled from the detail page (when enrichment ran). */
  advertiser_name:  string | null
  advertiser_role:  "particular" | "professional" | null
  /** Absolute URL of the advertiser's profile page (when found). */
  advertiser_profile_url: string | null
  /** TOTAL active listings on the advertiser's profile page across
   *  the whole portal. `null` when we couldn't reach / parse it. */
  advertiser_total_listings: number | null
  /** How many listings in THIS scan share the same advertiser name.
   *  Soft fallback only — `advertiser_total_listings` is the truth. */
  advertiser_occurrences: number
  /** Phone parsed from the listing's detail page (if any). */
  advertiser_phone: string | null
  /** How enrichment went for THIS listing:
   *   • "ok"          — fetched + extracted at least a name or role
   *   • "no_match"    — fetched but couldn't locate the advertiser
   *                     block. Surfaces as a different cell than fetch
   *                     failures so the admin knows to verify manually.
   *   • "fetch_failed"— the detail page didn't load (404/429/timeout)
   *   • "skipped"     — enrichment was disabled for this scan */
  enrichment_status: "ok" | "no_match" | "fetch_failed" | "skipped"
  /** Owner-likelihood score + tier + matched signals. */
  classification: OwnerClassification
}

export interface ProspectorResult {
  source_name:    string
  url_type:       string
  pages_scanned:  number
  total_found:    number
  /** Count of listings classified as "high" tier (score ≥70). */
  high_count:     number
  /** Ranked descending by classification score. */
  prospects:      OwnerProspect[]
  /** Soft warnings (e.g. partial crawl, slow source). Not errors. */
  warning?:       string
}

interface InputOpts {
  url:         string
  scanDepth?:  number   // default 3
  maxListings?: number  // default 60
  /** When true, follows each listing's detail page to extract the
   *  advertiser block (name + PROFESIONAL/PARTICULAR badge + phone).
   *  Significantly more accurate but ~8-15s slower. Default true. */
  enrich?:     boolean
}

/**
 * Admin-only — crawls a public listing URL (encuentra24, etc.),
 * classifies each listing as owner-published vs. agency-published
 * using deterministic heuristics, and returns a ranked prospect list.
 *
 * No persistence: the result lives on the client until the admin
 * does something with it (copy, click through, write to the seller).
 */
export async function analyzeOwnerListings(
  opts: InputOpts,
): Promise<ActionResult<ProspectorResult>> {
  await requireAdmin()

  const url = (opts.url ?? "").trim()
  if (!url) return { success: false, error: "Pegá un link del portal para analizar." }
  if (!/^https?:\/\//i.test(url)) {
    return { success: false, error: "El link debe empezar con http(s)." }
  }

  // Hard caps: 20 pages × ~20 listings/page on encuentra24 = up to
  // 400 cards, well beyond what cold outreach needs. We still allow
  // `maxListings` to clip below that. The fetcher rate-limits at
  // 1 req/sec/host, so 300 detail-page fetches = ~5 minutes of work
  // — keep that in mind vs the page's maxDuration.
  const result = await crawlSource(url, {
    scanDepth:   Math.max(1, Math.min(20,  opts.scanDepth   ?? 3)),
    maxListings: Math.max(1, Math.min(300, opts.maxListings ?? 60)),
  })

  if (result.urlType === "unsupported") {
    return { success: false, error: "Este portal todavía no está soportado." }
  }
  if (result.error) {
    return { success: false, error: `El crawler falló: ${result.error}` }
  }
  if (result.listings.length === 0) {
    return {
      success: true,
      data: {
        source_name:   result.sourceName,
        url_type:      result.urlType,
        pages_scanned: result.pagesScanned,
        total_found:   0,
        high_count:    0,
        prospects:     [],
        warning:       "El portal no devolvió listados. Probá con otra URL o aumentá el scan depth.",
      },
    }
  }

  // ── Enrichment: follow each detail page for advertiser info ───
  // This is the heart of the v2 prospector. The search-results card
  // doesn't show whether the publisher is a "PARTICULAR" or
  // "PROFESIONAL" — that's only on the listing's detail page. We
  // also use cross-listing repetition (same advertiser on 4+
  // listings ⇒ definitely an agent) to override misleading text.
  const enrich = opts.enrich !== false  // default true
  const urls = result.listings.map((c) => c.listing_url).filter((u): u is string => !!u)
  const enrichment = enrich && urls.length > 0
    ? await enrichListingsWithAdvertiser(urls)
    : { advertisers: new Map(), occurrencesByName: new Map(), totalsByProfileUrl: new Map() }

  // ── Classify each with the new signals ─────────────────────────
  const prospects: OwnerProspect[] = result.listings.map((c) => {
    const ad = c.listing_url ? enrichment.advertisers.get(c.listing_url) : undefined
    const nameKey = ad?.name?.toLowerCase().trim() ?? ""
    const occurrences = nameKey ? (enrichment.occurrencesByName.get(nameKey) ?? 0) : 0
    // Profile-page total — keyed by lowercased profile URL because two
    // listings from the same agent share one profile fetch.
    const profileKey = ad?.profileUrl?.toLowerCase().trim() ?? ""
    const totalListings = profileKey
      ? (enrichment.totalsByProfileUrl.get(profileKey) ?? null)
      : null

    // Enrichment status — three failure modes the UI distinguishes
    // so the admin knows where to look manually.
    let enrichmentStatus: OwnerProspect["enrichment_status"]
    if (!enrich)                                                enrichmentStatus = "skipped"
    else if (!ad)                                               enrichmentStatus = "fetch_failed"
    else if (!ad.name && !ad.role && !ad.phone)                 enrichmentStatus = "no_match"
    else                                                        enrichmentStatus = "ok"

    const classification = classifyOwner({
      title:                    c.title,
      description:              c.description,
      rawText:                  c.raw_text,
      agentOrCompany:           c.agent_or_company ?? ad?.name ?? undefined,
      advertiserRole:           ad?.role ?? null,
      advertiserTotalListings:  totalListings,
      advertiserOccurrences:    occurrences,
      advertiserName:           ad?.name ?? null,
    })
    return {
      listing_url:               c.listing_url ?? null,
      source_name:               c.source_name ?? result.sourceName,
      title:                     c.title       ?? null,
      price_text:                c.raw_price   ?? null,
      currency:                  c.raw_currency ?? null,
      location:                  c.location_text ?? null,
      excerpt:                   (c.raw_text ?? c.description ?? "").slice(0, 280) || null,
      advertiser_name:           ad?.name ?? null,
      advertiser_role:           ad?.role ?? null,
      advertiser_profile_url:    ad?.profileUrl ?? null,
      advertiser_total_listings: totalListings,
      advertiser_occurrences:    occurrences,
      advertiser_phone:          ad?.phone ?? null,
      enrichment_status:         enrichmentStatus,
      classification,
    }
  })

  // ── Sort: highest score first; within ties, prefer recent / featured.
  prospects.sort((a, b) =>
    b.classification.score - a.classification.score
    || (a.title ?? "").localeCompare(b.title ?? ""),
  )

  const highCount = prospects.filter((p) => p.classification.tier === "high").length

  return {
    success: true,
    data: {
      source_name:   result.sourceName,
      url_type:      result.urlType,
      pages_scanned: result.pagesScanned,
      total_found:   prospects.length,
      high_count:    highCount,
      prospects,
    },
  }
}
