"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { toE164 } from "@/lib/phone"

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
