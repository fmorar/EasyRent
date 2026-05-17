import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import type { AgentSearchInput } from "./property-search"
import type { Database } from "@/types/supabase"

type SearchRequestRow = Database["public"]["Tables"]["search_requests"]["Row"]

/**
 * Create (or reuse) a search_request when the agent comes up empty.
 *
 * Dedup rule: if there's already a non-terminal request for THIS lead
 * with substantially the same filters in the last 24 hours, return
 * its id instead of inserting a duplicate. "Same filters" =
 * (listing_type, property_type, first preferred zone). Price /
 * bedrooms / furnished can drift turn-to-turn as the lead refines
 * what they want — we don't want a new request for every variant.
 *
 * Returns null only on hard DB errors (insert failed twice). Callers
 * treat null as "agent is on its own this turn" — no follow-up
 * promise rendered.
 */
export async function createSearchRequest(args: {
  leadId:         string
  conversationId: string
  filters:        AgentSearchInput
}): Promise<{ id: string; reused: boolean } | null> {
  const admin = createAdminClient()

  // ── Dedup: look for an open request with similar shape ───────────
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const existing = await admin
    .from("search_requests")
    .select("id, filters, status")
    .eq("lead_id", args.leadId)
    .in("status", ["pending", "scraping", "completed"])
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(5)

  if (!existing.error && existing.data) {
    for (const row of existing.data as Pick<SearchRequestRow, "id" | "filters" | "status">[]) {
      if (filtersOverlap(row.filters as AgentSearchInput, args.filters)) {
        return { id: row.id, reused: true }
      }
    }
  }

  // ── Insert ────────────────────────────────────────────────────────
  const insert = await admin
    .from("search_requests")
    .insert({
      lead_id:         args.leadId,
      conversation_id: args.conversationId,
      filters:         args.filters as Database["public"]["Tables"]["search_requests"]["Insert"]["filters"],
      status:          "pending",
    })
    .select("id")
    .single()
  if (insert.error || !insert.data) {
    console.warn("[whatsapp-agent.search-requests] insert failed", insert.error?.message)
    return null
  }
  return { id: insert.data.id, reused: false }
}

/**
 * Two AgentSearchInputs are "the same enough" when they overlap on
 * the cheap-to-match shape filters. Price + furnished + bedroom
 * deltas don't count — the lead is just refining their criteria,
 * not asking us to search a new market.
 */
function filtersOverlap(a: AgentSearchInput, b: AgentSearchInput): boolean {
  if (a.listing_type !== b.listing_type)   return false
  if (a.property_type && b.property_type && a.property_type !== b.property_type) return false
  const az = (a.zones?.[0] ?? "").toLowerCase().trim()
  const bz = (b.zones?.[0] ?? "").toLowerCase().trim()
  if (az && bz && az !== bz) return false
  return true
}
