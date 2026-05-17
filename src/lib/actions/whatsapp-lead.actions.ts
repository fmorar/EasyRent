"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { toE164 } from "@/lib/phone"
import type { Database } from "@/types/supabase"

/**
 * Find an existing lead by canonical phone, or create a stub lead
 * for an inbound WhatsApp visitor we've never seen before.
 *
 * Lookup order:
 *   1. `leads.phone_e164` (exact E.164 match) — covers leads created
 *      by any form flow that ran through `capturePublicLead`, which
 *      now writes phone_e164.
 *   2. Fallback: scan `leads.phone` for legacy free-form values whose
 *      digit-only form matches. Cheap and bounded — used until the
 *      one-time backfill catches up older rows.
 *   3. Not found → create. The new lead is intentionally minimal —
 *      the agent enriches the profile turn by turn as the visitor
 *      reveals name, intent, budget, etc.
 *
 * Why a dedicated function (not `capturePublicLead`):
 *   • capturePublicLead has 24h dedup on (email + property_id) that
 *     we don't want for WhatsApp — every new conversation should
 *     resolve to the same lead, not a fresh row.
 *   • capturePublicLead writes `notes` from the form message; for
 *     WhatsApp the message persists into `conversation_messages`
 *     and `notes` stays clean for human-typed agent notes.
 *   • capturePublicLead fires email notifications + AI extraction
 *     — both managed differently on the WhatsApp flow (extraction
 *     runs per message, notification fires only on handoff).
 *
 * Always uses the admin client because the webhook is unauthenticated.
 */
export async function findOrCreateWhatsAppLead(args: {
  fromRaw: string                         // Twilio's "whatsapp:+506…" form
  /** Optional first body so we can pre-fill `notes` on creation. */
  firstMessage?: string | null
}): Promise<{
  leadId:    string
  phoneE164: string
  created:   boolean
}> {
  const phoneE164 = toE164(args.fromRaw)
  if (!phoneE164) {
    throw new Error(`findOrCreateWhatsAppLead: cannot normalize phone from "${args.fromRaw}"`)
  }

  const admin = createAdminClient()

  // Step 1 — canonical lookup.
  const byCanonical = await admin
    .from("leads")
    .select("id")
    .eq("phone_e164", phoneE164)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })  // newest wins if dupes exist
    .limit(1)
    .maybeSingle()

  if (byCanonical.data) {
    return { leadId: byCanonical.data.id, phoneE164, created: false }
  }

  // Step 2 — legacy fallback. Match leads whose free-form `phone`
  // strips down to the same digits as our E.164 (minus the "+").
  // Bounded scan because the index on phone_e164 is the fast path
  // for ~all rows post-backfill.
  const digits = phoneE164.slice(1)
  const byLegacy = await admin
    .from("leads")
    .select("id, phone")
    .ilike("phone", `%${digits.slice(-8)}%`)        // last 8 digits is enough
    .is("deleted_at", null)
    .limit(20)

  if (byLegacy.data) {
    for (const row of byLegacy.data) {
      // Re-normalize and compare exactly so "8888-8888" doesn't
      // accidentally collide with "+506 1888 8888".
      if (toE164(row.phone) === phoneE164) {
        // While we're here, opportunistically backfill the canonical
        // column so future lookups hit the fast index path.
        await admin.from("leads").update({ phone_e164: phoneE164 }).eq("id", row.id)
        return { leadId: row.id, phoneE164, created: false }
      }
    }
  }

  // Step 3 — create stub lead. Name is filled in by the agent
  // later via update_lead_profile when the visitor introduces
  // themselves; until then, dashboards show "Sin nombre · {phone}".
  const created = await admin
    .from("leads")
    .insert({
      full_name:      "Sin nombre",
      phone:          phoneE164,
      phone_e164:     phoneE164,
      source:         "whatsapp",
      contact_channel: "whatsapp",
      stage:          "new",
      notes:          args.firstMessage?.trim() || null,
    })
    .select("id")
    .single()

  if (created.error || !created.data) {
    throw new Error(
      `findOrCreateWhatsAppLead: insert failed: ${created.error?.message ?? "unknown"}`,
    )
  }

  return { leadId: created.data.id, phoneE164, created: true }
}

/**
 * Patch a lead with structured data the WhatsApp agent extracted
 * from the conversation. Used by the `update_lead_profile` tool.
 *
 * Allowlist of writable columns is intentional: the agent can shape
 * the funnel-relevant profile, but it canNOT touch:
 *   • stage, assigned_to, captured_by (CRM ownership)
 *   • is_archived, deleted_at (lifecycle)
 *   • interest_level (we derive that from enrichment; agent doesn't
 *     get to declare urgency on its own)
 *   • appointment_at / appointment_status (separate flow — visit
 *     request tool will own those)
 *
 * `preferred_zones` lives inside `extracted_data` JSONB because it's
 * an array of free-form strings and we don't want to add another
 * column. The merge is non-destructive: existing keys other than
 * `preferred_zones` survive.
 */
export async function updateLeadFromAgent(args: {
  leadId: string
  patch: AgentLeadPatch
}): Promise<{ updated: string[] }> {
  const admin   = createAdminClient()
  const patch   = args.patch
  const updated: string[] = []

  // Build the SQL UPDATE payload from the allowlisted fields.
  const dbPatch: Database["public"]["Tables"]["leads"]["Update"] = {}

  // full_name is non-nullable on the DB — we only OVERWRITE it,
  // never clear it. If the agent passes an empty string, ignore the
  // patch rather than corrupt the existing name.
  if (patch.full_name)         { dbPatch.full_name      = patch.full_name;                                         updated.push("full_name") }
  if (patch.email          !== undefined) { dbPatch.email          = patch.email          || null;                  updated.push("email") }
  if (patch.inquiry_type   !== undefined) { dbPatch.inquiry_type   = patch.inquiry_type   ?? null;                  updated.push("inquiry_type") }
  if (patch.move_in_window !== undefined) { dbPatch.move_in_window = patch.move_in_window ?? null;                  updated.push("move_in_window") }
  if (patch.budget_range   !== undefined) { dbPatch.budget_range   = patch.budget_range   ?? null;                  updated.push("budget_range") }
  if (patch.has_pets       !== undefined) { dbPatch.has_pets       = patch.has_pets       ?? null;                  updated.push("has_pets") }
  if (patch.party_size     !== undefined) { dbPatch.party_size     = patch.party_size     ?? null;                  updated.push("party_size") }

  // Merge preferred_zones into extracted_data without clobbering
  // other keys (e.g. thread_summary, AI-extracted questions/objections).
  if (patch.preferred_zones !== undefined) {
    const cur = await admin
      .from("leads")
      .select("extracted_data")
      .eq("id", args.leadId)
      .single()
    const next = {
      ...((cur.data?.extracted_data ?? {}) as Record<string, unknown>),
      preferred_zones: patch.preferred_zones.filter((z) => typeof z === "string" && z.trim()),
    }
    dbPatch.extracted_data = next
    updated.push("preferred_zones")
  }

  if (Object.keys(dbPatch).length === 0) {
    return { updated: [] }
  }

  const res = await admin
    .from("leads")
    .update(dbPatch)
    .eq("id", args.leadId)
    .select("id")
    .single()

  if (res.error) {
    throw new Error(`updateLeadFromAgent: ${res.error.message}`)
  }

  return { updated }
}

/** Patch type the agent tool can send. Mirrors the lead enums but
 *  every field is optional. Validation happens via Zod in the tool
 *  layer; this type is for the action signature. */
export type AgentLeadPatch = {
  full_name?:       string | null
  email?:           string | null
  inquiry_type?:    Database["public"]["Enums"]["lead_inquiry_type"]    | null
  move_in_window?:  Database["public"]["Enums"]["lead_move_in_window"]  | null
  budget_range?:    Database["public"]["Enums"]["lead_budget_range"]    | null
  has_pets?:        Database["public"]["Enums"]["lead_pets_status"]     | null
  party_size?:      number | null
  preferred_zones?: string[]
}

