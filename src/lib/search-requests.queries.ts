import "server-only"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/supabase"

type SearchRequestRow = Database["public"]["Tables"]["search_requests"]["Row"]
type ExternalListingRow = Database["public"]["Tables"]["external_listings"]["Row"]

export interface SearchRequestListItem {
  id:                string
  status:            string
  candidates_count:  number
  scrape_attempts:   number
  created_at:        string
  updated_at:        string
  scraped_at:        string | null
  contacted_lead:    boolean
  expired_at:        string
  filters:           Record<string, unknown>
  lead: {
    id:         string
    full_name:  string
    phone_e164: string | null
  } | null
  conversation_id: string | null
}

export interface AdvertiserMeta {
  name?:           string | null
  role?:           "particular" | "professional" | null
  phone?:          string | null
  profile_url?:    string | null
  listings_count?: number | null
  /** 0..1, where higher means "more likely an owner (not an agent)". */
  confidence?:     number | null
}

export interface CandidateRow {
  id:               string
  source_name:      string
  source_url:       string
  title:            string
  description:      string | null
  price:            number | null
  currency:         string | null
  listing_type:     string | null
  property_type:    string | null
  bedrooms:         number | null
  bathrooms:        number | null
  area_sqm:         number | null
  location_text:    string | null
  advertiser:       AdvertiserMeta | null
  last_seen_at:     string
}

/**
 * Admin-only listing of search_requests.
 *
 * Ordered "what needs my attention next" — open + scraped first
 * (these have candidates ready to be acted on), then in-flight, then
 * terminal. RLS gates this to admins; we still pass the user-scoped
 * client for defense-in-depth.
 */
export async function listSearchRequests(): Promise<SearchRequestListItem[]> {
  const supabase = await createClient()
  const res = await supabase
    .from("search_requests")
    .select(`
      id, status, candidates_count, scrape_attempts, created_at, updated_at,
      scraped_at, contacted_lead, expired_at, filters, conversation_id,
      lead:leads(id, full_name, phone_e164)
    `)
    .order("updated_at", { ascending: false })
    .limit(100)
  if (res.error) {
    console.warn("[search-requests.queries] list failed", res.error.message)
    return []
  }
  // Single-record vs array embed shape — type cast then normalize.
  type Row = SearchRequestRow & {
    lead: { id: string; full_name: string; phone_e164: string | null } | null
  }
  return (res.data as unknown as Row[]).map((r) => ({
    id:                r.id,
    status:            r.status,
    candidates_count:  r.candidates_count,
    scrape_attempts:   r.scrape_attempts,
    created_at:        r.created_at,
    updated_at:        r.updated_at,
    scraped_at:        r.scraped_at,
    contacted_lead:    r.contacted_lead,
    expired_at:        r.expired_at,
    filters:           (r.filters ?? {}) as Record<string, unknown>,
    lead:              r.lead,
    conversation_id:   r.conversation_id,
  }))
}

/**
 * Pull the candidates for one search_request.
 *
 * We don't have a hard FK from external_listings → search_requests
 * (an external listing can resurface across multiple searches), so
 * we filter by `raw_extracted.search_request_id` — the cron stashes
 * that key on every row it inserts.
 *
 * Sorted by owner-confidence DESC so the rows the admin should act
 * on first sit at the top.
 */
export async function getCandidatesForSearchRequest(
  searchRequestId: string,
): Promise<CandidateRow[]> {
  const supabase = await createClient()
  const res = await supabase
    .from("external_listings")
    .select("id, source_name, source_url, title, description, price, currency, listing_type, property_type, bedrooms, bathrooms, area_sqm, location_text, advertiser, last_seen_at")
    .eq("is_active", true)
    .contains("raw_extracted", { search_request_id: searchRequestId })
    .order("last_seen_at", { ascending: false })
    .limit(60)
  if (res.error) {
    console.warn("[search-requests.queries] candidates failed", res.error.message)
    return []
  }
  const rows = (res.data as Pick<ExternalListingRow,
    | "id" | "source_name" | "source_url" | "title" | "description"
    | "price" | "currency" | "listing_type" | "property_type"
    | "bedrooms" | "bathrooms" | "area_sqm" | "location_text"
    | "advertiser" | "last_seen_at"
  >[]) ?? []

  const mapped: CandidateRow[] = rows.map((r) => ({
    id:             r.id,
    source_name:    r.source_name,
    source_url:     r.source_url,
    title:          r.title,
    description:    r.description,
    price:          r.price == null ? null : Number(r.price),
    currency:       r.currency,
    listing_type:   r.listing_type,
    property_type:  r.property_type,
    bedrooms:       r.bedrooms,
    bathrooms:      r.bathrooms,
    area_sqm:       r.area_sqm == null ? null : Number(r.area_sqm),
    location_text:  r.location_text,
    advertiser:     (r.advertiser as AdvertiserMeta | null) ?? null,
    last_seen_at:   r.last_seen_at,
  }))

  // Sort by confidence desc, nulls last.
  return mapped.sort((a, b) => {
    const ac = a.advertiser?.confidence ?? -1
    const bc = b.advertiser?.confidence ?? -1
    return bc - ac
  })
}
