import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { formatPhoneDisplay } from "@/lib/phone"
import type { Database } from "@/types/supabase"
import { getPropertySummaryForAgent } from "./property-search"
import type { AgentSearchResult } from "./property-search"

type LeadRow              = Database["public"]["Tables"]["leads"]["Row"]
type ConversationRow      = Database["public"]["Tables"]["conversations"]["Row"]
type ConversationMessageRow = Database["public"]["Tables"]["conversation_messages"]["Row"]

/** How many messages we feed to the model on every turn.
 *  Twenty is the sweet spot:
 *    • covers the natural rhythm of a property-search WhatsApp thread
 *      (greeting + 3-5 discovery turns + 3 recommendations + follow-up)
 *    • stays well under gpt-4o-mini's 128K context even with ~200-char
 *      messages on both sides
 *    • when the thread grows past this, we'll lean on the rolling
 *      `thread_summary` stored in `extracted_data` (Phase 4+) instead
 *      of trying to feed the whole tail back in. */
export const RECENT_MESSAGES_LIMIT = 20

export interface AgentContext {
  /** All the lead's persisted state — what the agent knows so far. */
  lead:           LeadRow
  /** Open / pending / closed. The runner short-circuits if not 'open'. */
  conversation:   Pick<ConversationRow, "id" | "status" | "external_id" | "created_at" | "last_message_at">
  /** Last N messages, oldest → newest, both directions. */
  messages:       ConversationMessageRow[]
  /** Derived: which enrichment fields the agent has, which it still
   *  needs to ask for. Saves the model from re-deriving this every
   *  turn (and prevents the "but I already told you" failure mode). */
  collected:      CollectedSnapshot
  /** Rolling summary stored in `leads.extracted_data.thread_summary`
   *  — populated by the AI after every Nth turn when the thread gets
   *  long. Null on short / new threads. */
  threadSummary:  string | null
  /** When the most recent inbound message contains an easyrent
   *  property URL (`/p/<slug>`), we pre-resolve the property and
   *  expose it here so the agent's first reply can reference it
   *  naturally. This is the dominant entry path — every property
   *  page has a "Contactar por WhatsApp" button that pre-fills a
   *  link. Null when the last inbound has no recognizable slug or
   *  the slug doesn't resolve. */
  mentionedProperty: AgentSearchResult | null
}

export interface CollectedSnapshot {
  full_name:        string | null
  email:            string | null
  inquiry_type:     LeadRow["inquiry_type"]
  move_in_window:   LeadRow["move_in_window"]
  budget_range:     LeadRow["budget_range"]
  has_pets:         LeadRow["has_pets"]
  party_size:       number | null
  /** Free-text zones the lead mentioned (parsed out of messages or
   *  set via `update_lead_profile`). Stored under
   *  `extracted_data.preferred_zones`. */
  preferred_zones:  string[]
  /** Visit-prerequisite data — CR landlords always ask for these
   *  before agreeing to a visit. All live in `extracted_data` JSONB. */
  id_number:        string  | null
  parking_needed:   boolean | null
  parking_count:    number  | null
  occupation:       string  | null
  /** Field names that are still null. Used to seed the agent's
   *  next-question prompt. */
  pending:          Array<
    | "full_name" | "inquiry_type" | "move_in_window"
    | "budget_range" | "has_pets" | "party_size" | "preferred_zones"
    | "id_number" | "parking_needed" | "occupation"
  >
  /** Convenience: the subset of `pending` the agent MUST resolve
   *  before triggering `create_visit_request`. The prompt references
   *  this to keep the visit gate honest. */
  missingForVisit:  Array<
    | "full_name" | "id_number" | "party_size" | "has_pets"
    | "parking_needed" | "occupation"
  >
}

/**
 * Build the context the WhatsApp agent needs to take one turn.
 *
 * Single round-trip plan:
 *   • The runner has `conversationId` from the webhook.
 *   • One query pulls the conversation + the lead. We do this through
 *     two narrow selects (vs. an FK join) because the admin client
 *     returns better types that way and the second hop is sub-ms.
 *   • One query pulls the last 20 messages.
 *
 * The function is pure aside from DB reads — every downstream piece
 * (prompt builder, tool registry) is fed by `AgentContext` and never
 * has to re-query.
 */
export async function loadAgentContext(conversationId: string): Promise<AgentContext> {
  const admin = createAdminClient()

  // ── Conversation + lead ────────────────────────────────────────
  const convRes = await admin
    .from("conversations")
    .select("id, status, external_id, lead_id, created_at, last_message_at")
    .eq("id", conversationId)
    .single()
  if (convRes.error || !convRes.data) {
    throw new Error(`loadAgentContext: conversation ${conversationId} not found`)
  }
  const conv = convRes.data
  if (!conv.lead_id) {
    throw new Error(`loadAgentContext: conversation ${conversationId} has no lead — webhook should have linked one`)
  }

  const leadRes = await admin
    .from("leads")
    .select("*")
    .eq("id", conv.lead_id)
    .single()
  if (leadRes.error || !leadRes.data) {
    throw new Error(`loadAgentContext: lead ${conv.lead_id} not found`)
  }
  const lead = leadRes.data as LeadRow

  // ── Recent messages ────────────────────────────────────────────
  // Oldest-first so the runner can pass them straight to the model.
  // Pull DESC + reverse JS-side to keep the query indexable on
  // (conversation_id, created_at).
  const msgsRes = await admin
    .from("conversation_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(RECENT_MESSAGES_LIMIT)
  if (msgsRes.error) {
    throw new Error(`loadAgentContext: messages query failed: ${msgsRes.error.message}`)
  }
  const messages = ((msgsRes.data ?? []) as ConversationMessageRow[]).reverse()

  // ── Derived state ──────────────────────────────────────────────
  const extracted = (lead.extracted_data ?? null) as
    | {
        preferred_zones?: string[]
        thread_summary?:  string
        id_number?:       string | null
        parking_needed?:  boolean | null
        parking_count?:   number  | null
        occupation?:      string  | null
      }
    | null
  const preferred_zones = Array.isArray(extracted?.preferred_zones)
    ? extracted!.preferred_zones.filter((z): z is string => typeof z === "string")
    : []
  const threadSummary = typeof extracted?.thread_summary === "string"
    ? extracted.thread_summary
    : null
  const id_number      = typeof extracted?.id_number === "string" && extracted.id_number.trim()
    ? extracted.id_number.trim()
    : null
  const parking_needed = typeof extracted?.parking_needed === "boolean"
    ? extracted.parking_needed
    : null
  const parking_count  = typeof extracted?.parking_count === "number"
    ? extracted.parking_count
    : null
  const occupation     = typeof extracted?.occupation === "string" && extracted.occupation.trim()
    ? extracted.occupation.trim()
    : null

  // `full_name === "Sin nombre"` is our default for newly-created
  // WhatsApp leads — treat it as still pending so the agent asks for
  // the visitor's name.
  const namePending = !lead.full_name || lead.full_name === "Sin nombre"

  const pending: CollectedSnapshot["pending"] = []
  if (namePending)                  pending.push("full_name")
  if (!lead.inquiry_type)           pending.push("inquiry_type")
  if (!lead.move_in_window)         pending.push("move_in_window")
  if (!lead.budget_range)           pending.push("budget_range")
  if (!lead.has_pets)               pending.push("has_pets")
  if (!lead.party_size)             pending.push("party_size")
  if (preferred_zones.length === 0) pending.push("preferred_zones")
  if (!id_number)                   pending.push("id_number")
  if (parking_needed == null)       pending.push("parking_needed")
  if (!occupation)                  pending.push("occupation")

  // Subset of `pending` that GATES the visit-coordination step. The
  // agent must collect ALL of these before calling create_visit_request
  // (Phase 6 tool; meanwhile the prompt asks for them in a checklist).
  // Note: `move_in_window`, `budget_range`, `email`, and zones are
  // helpful but NOT mandatory at the visit gate — landlords care
  // primarily about who/with what/with how many cars/pets.
  const missingForVisit: CollectedSnapshot["missingForVisit"] = []
  if (namePending)             missingForVisit.push("full_name")
  if (!id_number)              missingForVisit.push("id_number")
  if (!lead.party_size)        missingForVisit.push("party_size")
  if (!lead.has_pets)           missingForVisit.push("has_pets")
  if (parking_needed == null)  missingForVisit.push("parking_needed")
  if (!occupation)             missingForVisit.push("occupation")

  // ── Mentioned property ─────────────────────────────────────────
  // Most leads arrive via "Contactar por WhatsApp" on a property
  // page; their first inbound is the auto-filled "Hola, vi esta
  // propiedad..." with a /p/<slug> URL. Pre-resolve it so the
  // agent's first reply can cite the property by name + price.
  const mentionedProperty = await findMentionedProperty(messages)

  return {
    lead,
    conversation: {
      id:              conv.id,
      status:          conv.status,
      external_id:     conv.external_id,
      created_at:      conv.created_at,
      last_message_at: conv.last_message_at,
    },
    messages,
    collected: {
      full_name:       namePending ? null : lead.full_name,
      email:           lead.email,
      inquiry_type:    lead.inquiry_type,
      move_in_window:  lead.move_in_window,
      budget_range:    lead.budget_range,
      has_pets:        lead.has_pets,
      party_size:      lead.party_size,
      preferred_zones,
      id_number,
      parking_needed,
      parking_count,
      occupation,
      pending,
      missingForVisit,
    },
    threadSummary,
    mentionedProperty,
  }
}

/**
 * Walk the messages newest → oldest, return the first /p/<slug>
 * URL we find in an INBOUND message and resolve it.
 *
 * We only look at inbound messages because outbound messages
 * (our own search results) contain property URLs constantly and
 * we don't want those to trigger "the lead mentioned this".
 *
 * Returns null when:
 *   • No inbound message contains a slug URL.
 *   • The slug resolves but the property no longer exists in the
 *     marketplace (deleted / off-market) — agent will respond to
 *     text content normally.
 */
async function findMentionedProperty(
  messages: ConversationMessageRow[],
): Promise<AgentSearchResult | null> {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.direction !== "inbound") continue
    const slug = extractPropertySlug(msg.content ?? "")
    if (!slug) continue
    return await getPropertySummaryForAgent(slug)
  }
  return null
}

/**
 * Extract an easyrent property slug from a message body.
 *
 * Matches any URL shape we send out, including:
 *   • https://www.easyrent.house/es/p/<slug>
 *   • https://easyrent.house/en/p/<slug>
 *   • www.easyrent.house/p/<slug>
 *   • bare "/p/<slug>" if someone pasted just the path
 *
 * Returns the first slug found, or null. Slugs are URL-safe:
 * lowercase, digits, hyphens, and the short hash suffix we append
 * (e.g. `bo-escalante-estudio-Jil1Y5`) — that's why the regex
 * accepts mixed case.
 */
export function extractPropertySlug(body: string): string | null {
  if (!body) return null
  const m = body.match(/\/p\/([a-zA-Z0-9-]+)/)
  if (!m) return null
  // Defensive: a stray trailing punctuation (".", ",", ")") can hitch
  // a ride on the slug if the user pasted oddly. Strip those.
  return m[1].replace(/[.,)\]]+$/, "")
}

/**
 * Render the collected snapshot as a compact Markdown block for the
 * system prompt. Designed to read like a CRM card so the model
 * "scans" it the same way a human would.
 */
export function renderCollectedSnapshot(c: CollectedSnapshot, phoneE164: string | null): string {
  const lines: string[] = []
  lines.push("## Perfil del lead (lo que ya sabemos)")
  if (c.full_name)              lines.push(`- Nombre: ${c.full_name}`)
  if (phoneE164)                lines.push(`- WhatsApp: ${formatPhoneDisplay(phoneE164)}`)
  if (c.email)                  lines.push(`- Correo: ${c.email}`)
  if (c.inquiry_type)           lines.push(`- Intención: ${INQUIRY_LABELS[c.inquiry_type]}`)
  if (c.move_in_window)         lines.push(`- Ventana de mudanza: ${MOVE_IN_LABELS[c.move_in_window]}`)
  if (c.budget_range)           lines.push(`- Presupuesto: ${BUDGET_LABELS[c.budget_range]}`)
  if (c.has_pets)               lines.push(`- Mascotas: ${PETS_LABELS[c.has_pets]}`)
  if (c.party_size != null)     lines.push(`- Personas: ${c.party_size}`)
  if (c.preferred_zones.length) lines.push(`- Zonas de interés: ${c.preferred_zones.join(", ")}`)
  if (c.id_number)              lines.push(`- Identificación: ${c.id_number}`)
  if (c.parking_needed != null) {
    lines.push(
      `- Parqueo: ${c.parking_needed ? `sí${c.parking_count ? ` (${c.parking_count} carro${c.parking_count === 1 ? "" : "s"})` : ""}` : "no necesita"}`,
    )
  }
  if (c.occupation)             lines.push(`- Profesión / trabajo: ${c.occupation}`)

  if (lines.length === 1) {
    // Only the heading — brand-new lead.
    lines.push("- (sin datos aún)")
  }

  if (c.pending.length > 0) {
    lines.push("")
    lines.push("## Datos que aún NO tenemos")
    for (const p of c.pending) lines.push(`- ${PENDING_LABELS[p]}`)
  }

  if (c.missingForVisit.length > 0) {
    lines.push("")
    lines.push("## Faltantes para COORDINAR VISITA (gating)")
    lines.push("Estos los pide el dueño antes de aprobar una visita. NO ofrezcas agendar visita hasta tenerlos todos:")
    for (const p of c.missingForVisit) lines.push(`- ${VISIT_GATE_LABELS[p]}`)
  } else if (c.full_name) {
    // Only declare "ready" once we actually have the basics.
    lines.push("")
    lines.push("## Estado para visita: completo")
    lines.push("Ya tenés todos los datos que el dueño pide. Si el lead confirma, podés coordinar la visita.")
  }
  return lines.join("\n")
}

// ── Label maps (ES) ────────────────────────────────────────────────

const INQUIRY_LABELS: Record<NonNullable<LeadRow["inquiry_type"]>, string> = {
  availability: "consultar disponibilidad",
  visit:        "coordinar visita",
  info:         "pedir información general",
}
const MOVE_IN_LABELS: Record<NonNullable<LeadRow["move_in_window"]>, string> = {
  immediate:           "inmediato",
  one_month:           "en menos de 1 mes",
  one_to_three_months: "entre 1 y 3 meses",
  three_to_six_months: "entre 3 y 6 meses",
  browsing:            "solo investigando",
}
const BUDGET_LABELS: Record<NonNullable<LeadRow["budget_range"]>, string> = {
  under_1000:         "menos de $1.000",
  between_1000_1500:  "$1.000 – $1.500",
  between_1500_2000:  "$1.500 – $2.000",
  between_2000_3000:  "$2.000 – $3.000",
  above_3000:         "más de $3.000",
}
const PETS_LABELS: Record<NonNullable<LeadRow["has_pets"]>, string> = {
  none:      "sin mascotas",
  small_dog: "perro pequeño",
  large_dog: "perro grande",
  cat:       "gato",
  multiple:  "varias mascotas",
}
const PENDING_LABELS: Record<CollectedSnapshot["pending"][number], string> = {
  full_name:       "nombre completo",
  inquiry_type:    "intención (alquiler, compra, visita)",
  move_in_window:  "cuándo se quiere mudar",
  budget_range:    "presupuesto",
  has_pets:        "mascotas",
  party_size:      "cuántas personas",
  preferred_zones: "zona(s) de interés",
  id_number:       "número de identificación (cédula, DIMEX o pasaporte)",
  parking_needed:  "si necesita parqueo (y cuántos carros)",
  occupation:      "profesión o lugar de trabajo",
}

const VISIT_GATE_LABELS: Record<CollectedSnapshot["missingForVisit"][number], string> = {
  full_name:      "nombre completo",
  id_number:      "número de identificación",
  party_size:     "cuántas personas vivirán",
  has_pets:       "si tiene mascotas (y de qué tipo)",
  parking_needed: "si necesita parqueo (y cuántos carros)",
  occupation:     "profesión o lugar de trabajo",
}
