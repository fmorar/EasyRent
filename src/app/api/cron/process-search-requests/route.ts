import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { crawlSource } from "@/lib/market-analysis/crawler"
import { enrichListingsWithAdvertiser } from "@/lib/owner-prospector-enrich"
import { normalizeListing } from "@/lib/market-analysis/normalizers"
import { composeEncuentra24Url } from "@/lib/whatsapp-agent/external-search"
import {
  createOwnerOutreachAttempt,
  sendOwnerOutreach,
  processQueuedOutreach,
  OUTREACH_MIN_CONFIDENCE,
  OUTREACH_TOP_N,
} from "@/lib/whatsapp-agent/owner-outreach"
import type { AgentSearchInput } from "@/lib/whatsapp-agent/property-search"
import type { Database } from "@/types/supabase"

/**
 * Vercel-cron handler: process pending search_requests.
 *
 * Fires every 30 minutes (see vercel.json). For each open request:
 *   1. Re-scrape Encuentra24 with deeper scope than the in-line
 *      fallback (2 pages, advertiser enrichment ON). Enrichment is
 *      what gives us the owner's phone — that's the whole point of
 *      doing this async.
 *   2. Persist candidates into `external_listings` (dedup by
 *      source_url, like the inline path).
 *   3. Score each candidate's "is this an owner vs an agent"
 *      confidence using the advertiser badge + repetition signals.
 *   4. Mark the request `completed` (or bump retries / fail after N).
 *
 * Does NOT message the lead or the owners yet — that's the next
 * phase, gated on WhatsApp Business template approval. Right now this
 * job populates the admin UI with actionable candidates.
 *
 * Auth: Vercel cron pings include `Authorization: Bearer <CRON_SECRET>`.
 * We refuse anything else so a random POST can't kick off a scrape.
 *
 * Runtime: nodejs (cheerio + DB writes).
 * Max attempts: 5 per request before we mark it failed.
 * Batch cap: 10 per tick — keeps total run-time under Vercel's limit
 * even when the queue grows.
 */
export const runtime    = "nodejs"
export const maxDuration = 300

const BATCH_SIZE                  = 10
const MAX_ATTEMPTS                = 5
const SCRAPE_DEPTH                = 2
const MAX_LISTINGS_PER_REQUEST    = 60
const SOURCE_NAME                 = "encuentra24"

type SearchRequestRow = Database["public"]["Tables"]["search_requests"]["Row"]
type ExternalInsert    = Database["public"]["Tables"]["external_listings"]["Insert"]

export async function GET(req: Request): Promise<Response> {
  if (!authOk(req)) return new NextResponse("forbidden", { status: 403 })

  const admin = createAdminClient()

  // Pick up the oldest pending/scraping rows that haven't expired
  // and haven't blown through the retry budget.
  const pickup = await admin
    .from("search_requests")
    .select("*")
    .in("status", ["pending", "scraping"])
    .lt("scrape_attempts", MAX_ATTEMPTS)
    .gt("expired_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE)
  if (pickup.error) {
    console.error("[cron.search-requests] pickup failed", pickup.error.message)
    return NextResponse.json({ ok: false, error: pickup.error.message }, { status: 500 })
  }

  const rows = (pickup.data ?? []) as SearchRequestRow[]
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, summary: "no pending requests" })
  }

  const results: Array<{ id: string; status: string; candidates: number; error?: string }> = []
  for (const row of rows) {
    results.push(await processOne(admin, row))
  }

  // Drain any outreach attempts that were stuck in `queued` because
  // the env flags weren't on at the time. This is the path that
  // "wakes the queue up" the FIRST cron tick after Meta approval +
  // env-var flip — no manual intervention needed.
  const drain = await processQueuedOutreach(admin, 20)

  console.log(
    `[cron.search-requests] processed ${results.length}: ${results.map((r) => `${r.id.slice(0, 8)}=${r.status}(${r.candidates})`).join(" ")} drained outreach: tried=${drain.tried} sent=${drain.sent}`,
  )
  return NextResponse.json({ ok: true, processed: results.length, results, outreach: drain })
}

// ── Per-request worker ───────────────────────────────────────────────

async function processOne(
  admin: ReturnType<typeof createAdminClient>,
  row:   SearchRequestRow,
): Promise<{ id: string; status: string; candidates: number; error?: string }> {
  const filters = row.filters as AgentSearchInput
  const nextAttempts = row.scrape_attempts + 1

  // Step 1 — mark as scraping so a concurrent cron tick doesn't pick
  // the same row. Best-effort; if the update loses a race we just
  // re-do the work, which is idempotent (upsert on source_url).
  await admin
    .from("search_requests")
    .update({ status: "scraping", scrape_attempts: nextAttempts })
    .eq("id", row.id)

  // Step 2 — compose URL. If filters are too thin to build a URL,
  // mark as failed (no point retrying).
  const url = composeEncuentra24Url(filters)
  if (!url) {
    await admin
      .from("search_requests")
      .update({ status: "failed", scraped_at: new Date().toISOString() })
      .eq("id", row.id)
    return { id: row.id, status: "failed", candidates: 0, error: "could not compose url" }
  }

  try {
    // Step 3 — deep crawl + advertiser enrichment.
    const crawl = await crawlSource(url, {
      scanDepth:   SCRAPE_DEPTH,
      maxListings: MAX_LISTINGS_PER_REQUEST,
    })
    if (crawl.error || crawl.listings.length === 0) {
      const failed = nextAttempts >= MAX_ATTEMPTS
      await admin
        .from("search_requests")
        .update({
          status:           failed ? "failed" : "pending",
          scraped_at:       new Date().toISOString(),
          candidates_count: 0,
        })
        .eq("id", row.id)
      return {
        id: row.id, status: failed ? "failed" : "pending", candidates: 0,
        error: crawl.error ?? "crawl returned 0 listings",
      }
    }

    // enrichListingsWithAdvertiser hits each detail page once for the
    // advertiser block, then each unique profile URL once to get the
    // "listings count" signal. Concurrency is hardcoded inside the
    // helper (4). On warm DNS this stays well under the cron's 300s
    // ceiling even at 60 listings.
    const detailUrls = crawl.listings
      .map((l) => l.listing_url)
      .filter((u): u is string => !!u)
    const enrichment = await enrichListingsWithAdvertiser(detailUrls)

    // Step 4 — normalize + upsert into external_listings. We re-fold
    // the advertiser data per listing here (the enrichment helper
    // returns it as a parallel Map keyed by listing_url).
    const upserts = crawl.listings
      .map((c): ExternalInsert | null => {
        const n = normalizeListing(c)
        if (!n.listing_url || !n.title) return null

        const adv = enrichment.advertisers.get(n.listing_url) ?? null
        const profileTotal = adv?.profileUrl
          ? enrichment.totalsByProfileUrl.get(adv.profileUrl.toLowerCase().trim()) ?? null
          : null
        // Profile-page count is the truer signal; fall back to the
        // weaker in-scan repetition by displayed name if we couldn't
        // reach the profile page.
        const listingsCount = profileTotal
          ?? (adv?.name ? enrichment.occurrencesByName.get(adv.name.toLowerCase().trim()) ?? null : null)
        const confidence = scoreOwnerConfidence({ role: adv?.role ?? null, listingsCount })

        return {
          source_name:    SOURCE_NAME,
          source_url:     n.listing_url,
          title:          (n.title ?? "").slice(0, 280),
          description:    n.description?.slice(0, 1500) ?? null,
          price:          n.price        ?? null,
          currency:       n.currency     ?? null,
          listing_type:   n.operation_type as ExternalInsert["listing_type"] ?? null,
          property_type:  mapPropertyType(n.property_type) ?? null,
          bedrooms:       n.bedrooms     ?? null,
          bathrooms:      n.bathrooms    ?? null,
          area_sqm:       n.built_area_m2 ?? null,
          location_text:  n.location_text ?? null,
          raw_extracted:  { ...n, search_url: url, search_request_id: row.id } as ExternalInsert["raw_extracted"],
          advertiser: adv
            ? ({
                name:           adv.name           ?? null,
                role:           adv.role           ?? null,
                phone:          adv.phone          ?? null,
                profile_url:    adv.profileUrl     ?? null,
                listings_count: listingsCount      ?? null,
                confidence,
              } as ExternalInsert["advertiser"])
            : null,
          last_seen_at:   new Date().toISOString(),
          is_active:      true,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    if (upserts.length > 0) {
      const upRes = await admin
        .from("external_listings")
        .upsert(upserts, { onConflict: "source_url", ignoreDuplicates: false })
      if (upRes.error) {
        console.warn("[cron.search-requests] upsert failed", upRes.error.message)
      }
    }

    await admin
      .from("search_requests")
      .update({
        status:           "completed",
        scraped_at:       new Date().toISOString(),
        candidates_count: upserts.length,
      })
      .eq("id", row.id)

    // ── Owner outreach auto-create ────────────────────────────────
    // Re-read the upserted rows (we need their ids + current
    // confidence) and pick the top N high-confidence candidates to
    // contact. The actual send is gated inside sendOwnerOutreach —
    // when WHATSAPP_OWNER_OUTREACH_ENABLED + template SID are set
    // the attempt fires; otherwise it stays in `queued` for later.
    const persisted = await admin
      .from("external_listings")
      .select("id, title, listing_type, advertiser")
      .contains("raw_extracted", { search_request_id: row.id })
      .eq("is_active", true)
    if (persisted.data && persisted.data.length > 0) {
      const sorted = persisted.data
        .map((r) => {
          const adv = r.advertiser as { confidence?: number } | null
          return { row: r, confidence: adv?.confidence ?? 0 }
        })
        .filter((x) => x.confidence >= OUTREACH_MIN_CONFIDENCE)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, OUTREACH_TOP_N)

      for (const { row: cand } of sorted) {
        const created = await createOwnerOutreachAttempt(admin, {
          searchRequestId:   row.id,
          externalListingId: cand.id,
          externalListing:   {
            title:        cand.title,
            listing_type: cand.listing_type,
            advertiser:   cand.advertiser,
          },
        })
        if (!created || created.reused) continue
        // Try to send NOW. If gated off, this is a no-op and the row
        // stays queued — processQueuedOutreach picks it up later.
        const att = await admin
          .from("owner_outreach_attempts")
          .select("*")
          .eq("id", created.id)
          .single()
        if (att.data) {
          await sendOwnerOutreach(admin, att.data)
        }
      }
    }

    return { id: row.id, status: "completed", candidates: upserts.length }
  } catch (err) {
    const msg    = err instanceof Error ? err.message : String(err)
    const failed = nextAttempts >= MAX_ATTEMPTS
    await admin
      .from("search_requests")
      .update({
        status:     failed ? "failed" : "pending",
        scraped_at: new Date().toISOString(),
      })
      .eq("id", row.id)
    return { id: row.id, status: failed ? "failed" : "pending", candidates: 0, error: msg }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function authOk(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // No secret configured → only allow in dev. Refuse in prod so a
    // misconfig doesn't leave the endpoint open.
    return process.env.VERCEL_ENV !== "production"
  }
  const header = req.headers.get("authorization")
  return header === `Bearer ${secret}`
}

/**
 * Score the likelihood that an advertiser is the OWNER (vs an agent
 * masquerading as one). Higher = more likely owner.
 *
 *   1.00  particular badge + 1 listing
 *   0.85  particular badge + 2 listings
 *   0.70  particular badge + 3-5 listings (probably an investor with units)
 *   0.40  particular badge + 6+ listings (small agency in disguise)
 *   0.55  no badge + 1 listing                 (unknown; lean owner)
 *   0.30  no badge + multiple listings
 *   0.10  professional badge (clearly an agency)
 *
 * The "agent" tier in the user's vision is everything below 0.50.
 * The cron just persists the score; downstream code decides how to
 * filter on it.
 */
function scoreOwnerConfidence(
  a: { role?: string | null; listingsCount?: number | null } | undefined,
): number {
  if (!a) return 0.5
  const count = typeof a.listingsCount === "number" ? a.listingsCount : 0
  if (a.role === "professional") return 0.10
  if (a.role === "particular") {
    if (count <= 1) return 1.00
    if (count <= 2) return 0.85
    if (count <= 5) return 0.70
    return 0.40
  }
  // No badge — fall back to listings count as the only signal.
  if (count <= 1) return 0.55
  return 0.30
}

function mapPropertyType(v: string | undefined): ExternalInsert["property_type"] | null {
  if (!v) return null
  if (v === "apartment"  || v === "apartamento") return "apartment"
  if (v === "house"      || v === "casa")        return "house"
  if (v === "land"       || v === "lote")        return "land"
  if (v === "commercial" || v === "local")       return "commercial"
  if (v === "office"     || v === "oficina")     return "office"
  if (v === "warehouse"  || v === "bodega")      return "warehouse"
  return null
}
