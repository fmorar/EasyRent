import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { maybeAdvanceLeadStage } from "@/lib/leads/stage-machine"
import type { Database } from "@/types/supabase"

type LeadRow         = Database["public"]["Tables"]["leads"]["Row"]
type VisitInsert     = Database["public"]["Tables"]["visit_requests"]["Insert"]

export interface CreateVisitRequestInput {
  leadId:           string
  conversationId:   string
  /** Slug of an internal property (`properties.slug`) the lead wants
   *  to visit. If passed, we resolve it and link via property_id.
   *  Unknown / external slugs get attached via the notes field. */
  propertySlug?:    string | null
  /** Free-text date preference the lead gave ("esta semana", "el
   *  sábado", "20 de mayo"). Operator translates into a real slot. */
  preferredDate?:   string | null
  /** Free-text time slot ("mañana", "tarde", "después de 5pm"). */
  preferredTimeSlot?: string | null
  mode?:            "in_person" | "virtual"
  notes?:           string | null
}

export type CreateVisitRequestResult =
  | { ok: true;  requestId: string; advancedStage: boolean }
  | { ok: false; reason: "gate_incomplete"; missing: string[] }
  | { ok: false; reason: "lead_not_found" | "insert_failed"; error?: string }

/**
 * Server-side implementation of the agent's create_visit_request tool.
 *
 * The agent's prompt already asks for the 6 visit-gate fields before
 * promising to schedule. This function is the BACKSTOP: it refuses
 * to create the request if any field is missing and surfaces exactly
 * what's missing back to the model so the next turn can ask the
 * right question. Double-defense against an overeager agent skipping
 * the gate.
 *
 * Side effects on success:
 *   1. visit_requests row inserted (status='pending')
 *   2. Conversation status flipped to 'pending' so the bot stops
 *      auto-replying — the human operator now owns coordinating the
 *      actual datetime with the property owner.
 *   3. Lead stage advances to `visit_scheduled` (via the
 *      stage machine, monotonic so already-advanced leads no-op).
 */
export async function createVisitRequest(
  input: CreateVisitRequestInput,
): Promise<CreateVisitRequestResult> {
  const admin = createAdminClient()

  // ── Load + gate-check the lead ────────────────────────────────────
  const leadRes = await admin
    .from("leads")
    .select("id, full_name, party_size, has_pets, extracted_data")
    .eq("id", input.leadId)
    .maybeSingle()
  if (leadRes.error || !leadRes.data) {
    return { ok: false, reason: "lead_not_found", error: leadRes.error?.message }
  }
  const lead = leadRes.data as Pick<LeadRow,
    "id" | "full_name" | "party_size" | "has_pets" | "extracted_data"
  >
  const extracted = (lead.extracted_data ?? null) as
    | {
        id_number?:      string  | null
        parking_needed?: boolean | null
        occupation?:     string  | null
      }
    | null

  const missing: string[] = []
  if (!lead.full_name || lead.full_name === "Sin nombre") missing.push("full_name")
  if (!extracted?.id_number?.trim())                       missing.push("id_number")
  if (lead.party_size == null)                             missing.push("party_size")
  if (!lead.has_pets)                                      missing.push("has_pets")
  if (typeof extracted?.parking_needed !== "boolean")      missing.push("parking_needed")
  if (!extracted?.occupation?.trim())                      missing.push("occupation")

  if (missing.length > 0) {
    return { ok: false, reason: "gate_incomplete", missing }
  }

  // ── Resolve property slug (optional) ──────────────────────────────
  let propertyId:        string | null = null
  let externalListingId: string | null = null
  if (input.propertySlug) {
    const propRes = await admin
      .from("properties")
      .select("id")
      .eq("slug", input.propertySlug)
      .is("deleted_at", null)
      .maybeSingle()
    if (propRes.data) {
      propertyId = propRes.data.id
    }
    // Note: external_listings don't have a meaningful slug — only
    // source_url — so we deliberately skip a fallback lookup there.
    // If the agent passed a non-internal slug, we just keep the
    // request "untargeted" and the operator will pair it later.
  }

  // ── Insert the request ───────────────────────────────────────────
  const insert: VisitInsert = {
    lead_id:             input.leadId,
    conversation_id:     input.conversationId,
    property_id:         propertyId,
    external_listing_id: externalListingId,
    preferred_date:      input.preferredDate?.trim()      || null,
    preferred_time_slot: input.preferredTimeSlot?.trim()  || null,
    mode:                input.mode ?? "in_person",
    status:              "pending",
    notes:               input.notes?.trim() || null,
  }
  const insRes = await admin
    .from("visit_requests")
    .insert(insert)
    .select("id")
    .single()
  if (insRes.error || !insRes.data) {
    return { ok: false, reason: "insert_failed", error: insRes.error?.message }
  }
  const requestId = insRes.data.id

  // ── Side effects ─────────────────────────────────────────────────
  // 1. Conversation moves to pending (human handoff). The bot's
  //    inbound webhook short-circuits on status !== 'open' so this
  //    is the implicit kill switch for further auto-responses.
  await admin
    .from("conversations")
    .update({ status: "pending" })
    .eq("id", input.conversationId)

  // 2. Lead funnel advances. Monotonic — if the lead was already
  //    further along (negotiating, closed), this is a no-op.
  const stageRes = await maybeAdvanceLeadStage({
    leadId:    input.leadId,
    suggested: "visit_scheduled",
    reason:    "visit-request-created",
  })

  // 3. (Future) notification fan-out: email the assigned agent, ping
  //    the owner's WhatsApp, queue a calendar suggestion. Left as
  //    TODOs for Phase 7 — the row exists, the operator can act on
  //    it from the dashboard meanwhile.

  console.log(
    `[visit-request] created id=${requestId} lead=${input.leadId} property=${propertyId ?? "(none)"} mode=${input.mode ?? "in_person"}`,
  )

  return { ok: true, requestId, advancedStage: stageRes.advanced }
}
