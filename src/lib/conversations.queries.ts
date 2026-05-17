import "server-only"
import { createClient } from "@/lib/supabase/server"
import { isAdminRole } from "@/lib/roles"
import { getPropertySummaryForAgent, type AgentSearchResult } from "@/lib/whatsapp-agent/property-search"
import { extractPropertySlug } from "@/lib/whatsapp-agent/state"
import type { Profile } from "@/types"
import type { Database } from "@/types/supabase"

type ConversationRow      = Database["public"]["Tables"]["conversations"]["Row"]
type ConversationMessageRow = Database["public"]["Tables"]["conversation_messages"]["Row"]
type LeadRow              = Database["public"]["Tables"]["leads"]["Row"]

/**
 * Dashboard-side queries for the WhatsApp concierge surface.
 *
 * Visibility rules:
 *   • owner_admin / super_admin → every conversation in the org.
 *   • agent → only conversations whose linked lead is assigned to them.
 *     Unassigned leads (the common state right after a WhatsApp visitor
 *     pings us for the first time) are admin-only until an admin claims
 *     and assigns. Agents can still see their own once assigned.
 *
 * All queries use the user-scoped Supabase client (NOT the admin one)
 * so RLS still applies — these helpers add an extra defensive filter
 * on top.
 */

export interface ConversationListItem {
  id:             string
  status:         Database["public"]["Enums"]["conversation_status"]
  external_id:    string | null            // phone in E.164
  last_message_at: string | null
  created_at:     string
  lead: {
    id:        string
    full_name: string
    stage:     Database["public"]["Enums"]["lead_stage"] | null
    phone_e164: string | null
    assigned_to: string | null
  }
  /** Last message in the thread (either direction). Null when the
   *  conversation row exists but has no messages yet — shouldn't
   *  happen in normal flow but we tolerate it. */
  last_message: Pick<
    ConversationMessageRow,
    "id" | "direction" | "content" | "created_at"
  > | null
  /** Count of inbound messages newer than the most-recent outbound.
   *  Drives the "unread" dot on the list row. */
  unread_count: number
}

export interface ConversationDetail {
  conversation:     ConversationRow
  lead:             LeadRow
  messages:         ConversationMessageRow[]
  /** Pre-resolved property if any inbound mentioned a /p/<slug> URL.
   *  Same helper the agent uses, so what humans see matches what the
   *  agent saw on its last turn. */
  mentionedProperty: AgentSearchResult | null
}

/**
 * List conversations the current viewer is allowed to see, newest
 * first. The list page renders this directly.
 */
export async function listConversationsForUser(args: {
  profile: Profile
  /** Optional status filter (the page's URL ?status= param). */
  status?: Database["public"]["Enums"]["conversation_status"]
}): Promise<ConversationListItem[]> {
  const supabase = await createClient()
  const isAdmin  = isAdminRole(args.profile.role)

  // ── Conversations + their leads ────────────────────────────────
  // PostgREST embedded select pulls both rows in one round-trip.
  // The lead embed lets us filter at the relationship level for
  // non-admin viewers (`assigned_to=eq.<me>`).
  let q = supabase
    .from("conversations")
    .select(`
      id, status, external_id, last_message_at, created_at,
      lead:leads!inner(id, full_name, stage, phone_e164, assigned_to)
    `)
    .eq("channel", "whatsapp")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(100)

  if (args.status) q = q.eq("status", args.status)
  if (!isAdmin) {
    // Filter on the embedded relationship — only conversations whose
    // lead is assigned to this viewer.
    q = q.eq("lead.assigned_to", args.profile.id)
  }

  const convRes = await q
  if (convRes.error) {
    console.warn("[conversations.queries] list failed", convRes.error.message)
    return []
  }
  const conversations = (convRes.data ?? []) as Array<{
    id:              string
    status:          Database["public"]["Enums"]["conversation_status"]
    external_id:     string | null
    last_message_at: string | null
    created_at:      string
    lead: {
      id:          string
      full_name:   string
      stage:       Database["public"]["Enums"]["lead_stage"] | null
      phone_e164:  string | null
      assigned_to: string | null
    }
  }>

  if (conversations.length === 0) return []

  // ── Latest message + unread count per conversation ─────────────
  // We do one extra query against conversation_messages, scoped to the
  // ids we just loaded. Counting unread (= inbound newer than last
  // outbound) in JS is simpler than CTE-ing it in PostgREST, and the
  // volume per thread is small (<200 typically).
  const ids = conversations.map((c) => c.id)
  const msgsRes = await supabase
    .from("conversation_messages")
    .select("id, conversation_id, direction, content, created_at")
    .in("conversation_id", ids)
    .order("created_at", { ascending: false })
    .limit(500)
  const msgs = (msgsRes.data ?? []) as Array<
    Pick<ConversationMessageRow, "id" | "conversation_id" | "direction" | "content" | "created_at">
  >

  const messagesByConv = new Map<string, typeof msgs>()
  for (const m of msgs) {
    const bucket = messagesByConv.get(m.conversation_id) ?? []
    bucket.push(m)
    messagesByConv.set(m.conversation_id, bucket)
  }

  return conversations.map((c) => {
    const threadMsgs = messagesByConv.get(c.id) ?? []
    const latest     = threadMsgs[0] ?? null
    let unread = 0
    for (const m of threadMsgs) {
      // threadMsgs is newest-first; stop counting once we hit our own outbound
      if (m.direction === "outbound") break
      unread += 1
    }
    return {
      id:              c.id,
      status:          c.status,
      external_id:     c.external_id,
      last_message_at: c.last_message_at,
      created_at:      c.created_at,
      lead:            c.lead,
      last_message:    latest
        ? { id: latest.id, direction: latest.direction, content: latest.content, created_at: latest.created_at }
        : null,
      unread_count: unread,
    }
  })
}

/**
 * Load one conversation with its full message history + linked lead.
 * Returns null when the conversation doesn't exist OR the viewer
 * isn't allowed to see it (admin OR assigned agent).
 */
export async function getConversationDetailForUser(args: {
  profile:        Profile
  conversationId: string
}): Promise<ConversationDetail | null> {
  const supabase = await createClient()
  const isAdmin  = isAdminRole(args.profile.role)

  const convRes = await supabase
    .from("conversations")
    .select("*")
    .eq("id", args.conversationId)
    .maybeSingle()
  if (convRes.error || !convRes.data) return null
  const conversation = convRes.data as ConversationRow
  if (!conversation.lead_id) return null

  const leadRes = await supabase
    .from("leads")
    .select("*")
    .eq("id", conversation.lead_id)
    .maybeSingle()
  if (leadRes.error || !leadRes.data) return null
  const lead = leadRes.data as LeadRow

  // Role gate — agents only see their own assigned threads.
  if (!isAdmin && lead.assigned_to !== args.profile.id) return null

  const msgsRes = await supabase
    .from("conversation_messages")
    .select("*")
    .eq("conversation_id", args.conversationId)
    .order("created_at", { ascending: true })
    .limit(500)
  const messages = (msgsRes.data ?? []) as ConversationMessageRow[]

  // Re-resolve the mentioned property the same way the agent does so
  // the dashboard reflects the bot's mental model.
  let mentionedProperty: AgentSearchResult | null = null
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.direction !== "inbound") continue
    const slug = extractPropertySlug(m.content ?? "")
    if (slug) {
      mentionedProperty = await getPropertySummaryForAgent(slug)
      break
    }
  }

  return { conversation, lead, messages, mentionedProperty }
}
