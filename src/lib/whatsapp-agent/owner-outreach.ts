import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { getTwilio, getTwilioWhatsAppFrom } from "@/lib/twilio/client"
import { toTwilioWhatsAppAddr } from "@/lib/phone"
import { findOrCreateWhatsAppConversation } from "@/lib/conversations"
import type { Database } from "@/types/supabase"

type OutreachRow      = Database["public"]["Tables"]["owner_outreach_attempts"]["Row"]
type OutreachInsert   = Database["public"]["Tables"]["owner_outreach_attempts"]["Insert"]
type ExternalListing  = Database["public"]["Tables"]["external_listings"]["Row"]

/**
 * Owner-outreach pipeline — fully automated.
 *
 *   createOwnerOutreachAttempt()  → inserts a row with status='queued'
 *   sendOwnerOutreach()           → tries to fire via Twilio, updates status
 *
 * Gating: the actual Twilio send is gated by env vars.
 *
 *   WHATSAPP_OWNER_OUTREACH_ENABLED       — "true" to allow real sends
 *   TWILIO_OWNER_OUTREACH_TEMPLATE_SID    — Twilio Content SID (HX...)
 *                                           Required when the flag is on.
 *
 * When either of those is missing, attempts stay in `queued` and the
 * admin UI shows them as "waiting for Meta approval". Once the
 * sender is approved + the template is approved + the env vars are
 * set, the next cron tick re-tries every queued row and they flip to
 * `sent` without any code change.
 *
 * Why gate the SEND and not the CREATE: we want the queue to keep
 * building from day 1 so operators can see the volume + quality of
 * candidates the system would have contacted. That's both a debug
 * signal (is our confidence scoring sane?) and a demand forecast for
 * when we DO turn it on.
 */

/** Threshold for an automated outreach. Below this we don't even
 *  create an attempt — these candidates show up only in the admin UI
 *  for manual review (no human-in-loop on the auto path). */
export const OUTREACH_MIN_CONFIDENCE = 0.75

/** How many of the top candidates per search_request we try to reach.
 *  Keeping it small (3) protects our sender reputation and gives the
 *  lead a focused shortlist when matches come back. */
export const OUTREACH_TOP_N = 3

/** Max send retries before we give up. Twilio template failures
 *  (template not approved, locale mismatch, recipient blocked) are
 *  typically permanent — re-trying is cheap but the cap protects us
 *  from infinite loops on misconfig. */
export const OUTREACH_MAX_SEND_ATTEMPTS = 5

type AdminClient = ReturnType<typeof createAdminClient>

export interface CreateAttemptInput {
  searchRequestId:   string
  externalListingId: string
  externalListing:   Pick<ExternalListing,
    "title" | "listing_type" | "advertiser"
  >
}

/**
 * Idempotent — the unique index on (search_request_id,
 * target_phone_e164) means a second call for the same pair becomes a
 * no-op SELECT. Returns the resolved attempt id either way.
 */
export async function createOwnerOutreachAttempt(
  admin: AdminClient,
  input: CreateAttemptInput,
): Promise<{ id: string; reused: boolean } | null> {
  const adv = input.externalListing.advertiser as {
    name?:        string | null
    role?:        string | null
    phone?:       string | null
    confidence?:  number | null
  } | null
  if (!adv?.phone) return null

  // Normalize the phone to E.164 in case the scraper left noise in
  // the string.
  const phone = normalizePhone(adv.phone)
  if (!phone) return null

  // Pre-build the template variables. We persist them so a later
  // re-try sends the same body even if the upstream listing changed.
  const templateVariables = buildTemplateVariables({
    advertiserName: adv.name ?? null,
    listingTitle:   input.externalListing.title,
    listingType:    input.externalListing.listing_type as "rent" | "sale" | null,
  })

  const insert: OutreachInsert = {
    search_request_id:   input.searchRequestId,
    external_listing_id: input.externalListingId,
    target_phone_e164:   phone,
    target_name:         adv.name        ?? null,
    target_role:         adv.role        ?? null,
    target_confidence:   adv.confidence  ?? null,
    channel:             "whatsapp",
    template_variables:  templateVariables as OutreachInsert["template_variables"],
    status:              "queued",
  }

  const res = await admin
    .from("owner_outreach_attempts")
    .insert(insert)
    .select("id")
    .single()
  if (res.error) {
    // 23505 = unique violation = the attempt already exists. Resolve
    // its id with a follow-up read so callers get a stable contract.
    if (res.error.code === "23505") {
      const existing = await admin
        .from("owner_outreach_attempts")
        .select("id")
        .eq("search_request_id", input.searchRequestId)
        .eq("target_phone_e164", phone)
        .maybeSingle()
      if (existing.data) return { id: existing.data.id, reused: true }
    }
    console.warn("[owner-outreach] create failed", res.error.message)
    return null
  }
  return { id: res.data.id, reused: false }
}

/**
 * Try to fire the outbound for ONE attempt.
 *
 * Hard-coded preconditions (all must hold or we mark status accordingly):
 *   • WHATSAPP_OWNER_OUTREACH_ENABLED === "true"      → else status stays 'queued'
 *   • TWILIO_OWNER_OUTREACH_TEMPLATE_SID is set        → else status stays 'queued'
 *   • send_attempts < OUTREACH_MAX_SEND_ATTEMPTS       → else status='failed'
 *
 * On send success:
 *   • Open a `kind='owner'` conversation linked to the attempt
 *   • Persist the outbound message into conversation_messages so the
 *     owner-facing agent sees it as the first turn of the thread
 *   • Set status='sent', sent_at=now, external_msg_id=<Twilio sid>
 *
 * On Twilio failure: increment send_attempts, save last_error, and
 * promote to 'failed' once we hit the cap.
 */
export async function sendOwnerOutreach(
  admin:    AdminClient,
  attempt:  OutreachRow,
): Promise<{ ok: boolean; reason?: string }> {
  if (process.env.WHATSAPP_OWNER_OUTREACH_ENABLED !== "true") {
    return { ok: false, reason: "outreach disabled" }
  }
  const templateSid = process.env.TWILIO_OWNER_OUTREACH_TEMPLATE_SID
  if (!templateSid) {
    return { ok: false, reason: "no template SID configured" }
  }
  if (attempt.send_attempts >= OUTREACH_MAX_SEND_ATTEMPTS) {
    await admin
      .from("owner_outreach_attempts")
      .update({ status: "failed", last_error: "max attempts exceeded" })
      .eq("id", attempt.id)
    return { ok: false, reason: "max attempts" }
  }

  // Bump attempt counter up front so a Twilio timeout doesn't let us
  // retry the same row forever.
  const nextAttempts = attempt.send_attempts + 1
  await admin
    .from("owner_outreach_attempts")
    .update({ send_attempts: nextAttempts })
    .eq("id", attempt.id)

  try {
    const twilio = getTwilio()
    const from   = getTwilioWhatsAppFrom()
    const to     = toTwilioWhatsAppAddr(attempt.target_phone_e164)

    const message = await twilio.messages.create({
      from,
      to,
      contentSid:       templateSid,
      contentVariables: JSON.stringify(attempt.template_variables ?? {}),
    })

    // Open a conversation row for the owner — this is what the
    // inbound webhook will match on later when they reply.
    const conv = await findOrCreateWhatsAppConversation({
      // Owner conversations don't have a real lead — point at the
      // search_request's lead just so the existing FK is non-null;
      // the `kind` column is what gates the agent dispatch.
      leadId:    await getSearchRequestLeadId(admin, attempt.search_request_id),
      phoneE164: attempt.target_phone_e164,
    })
    // Make sure the conversation is flagged as owner-onboarding so
    // the inbound dispatcher routes replies correctly.
    await admin.from("conversations").update({ kind: "owner" }).eq("id", conv.id)

    // Persist the outbound message so the owner agent's context shows
    // the first turn (the template body, rendered with variables).
    await admin
      .from("conversation_messages")
      .insert({
        conversation_id: conv.id,
        direction:       "outbound",
        content:         renderTemplate(attempt.template_variables as Record<string, string>),
        external_msg_id: message.sid,
      })

    await admin
      .from("owner_outreach_attempts")
      .update({
        status:          "sent",
        sent_at:         new Date().toISOString(),
        external_msg_id: message.sid,
        template_sid:    templateSid,
        conversation_id: conv.id,
        last_error:      null,
      })
      .eq("id", attempt.id)

    console.log(
      `[owner-outreach] sent attempt=${attempt.id.slice(0, 8)} to=${attempt.target_phone_e164} sid=${message.sid}`,
    )
    return { ok: true }
  } catch (err) {
    const e = err as { code?: number; status?: number; message?: string }
    const errStr = `code=${e.code ?? "?"} status=${e.status ?? "?"} msg=${e.message ?? String(err)}`
    const isPermanent = nextAttempts >= OUTREACH_MAX_SEND_ATTEMPTS
    await admin
      .from("owner_outreach_attempts")
      .update({
        status:     isPermanent ? "failed" : "queued",
        last_error: errStr,
      })
      .eq("id", attempt.id)
    console.error(`[owner-outreach] send failed attempt=${attempt.id.slice(0, 8)} ${errStr}`)
    return { ok: false, reason: errStr }
  }
}

/**
 * Pickup the queued-and-eligible attempts and try to send them.
 * Called by the same cron that creates them after a scrape, and
 * also by a separate "retry queued attempts" tick once Meta approves
 * the template (so the queue drains without code change).
 */
export async function processQueuedOutreach(
  admin: AdminClient,
  limit = 20,
): Promise<{ tried: number; sent: number }> {
  if (process.env.WHATSAPP_OWNER_OUTREACH_ENABLED !== "true") {
    return { tried: 0, sent: 0 }
  }
  const res = await admin
    .from("owner_outreach_attempts")
    .select("*")
    .eq("status", "queued")
    .lt("send_attempts", OUTREACH_MAX_SEND_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(limit)
  if (res.error || !res.data) return { tried: 0, sent: 0 }

  let sent = 0
  for (const row of res.data as OutreachRow[]) {
    const r = await sendOwnerOutreach(admin, row)
    if (r.ok) sent += 1
  }
  return { tried: res.data.length, sent }
}

// ── Template + helpers ───────────────────────────────────────────────

/**
 * Render the template variables into the SAME body we asked Meta to
 * approve. Used to persist the outbound message into our DB after
 * Twilio sends it via contentSid (Twilio doesn't echo the rendered
 * body back, so we re-render locally for dashboard / agent context).
 *
 * If the template variables fingerprint here diverges from what
 * Meta approved, the dashboard's "first message" view will say one
 * thing and the lead will have actually seen another. So: keep this
 * function in sync with the Meta-submitted template body.
 */
export function renderTemplate(vars: Record<string, string>): string {
  const firstName     = vars["1"] || "Hola"
  const greetingLine  = firstName.startsWith("Hola") ? firstName : `Hola ${firstName},`
  const listingTitle  = vars["2"] || ""
  const commission    = vars["3"] || ""

  return `${greetingLine}

Soy del equipo de easyrent.house. Vi que tenés esta propiedad disponible:

${listingTitle}

Tengo un cliente interesado en una propiedad similar y me gustaría saber si te interesa que se la ofrezca formalmente. También, ¿has trabajado con agentes antes?

${commission}

Dentro del servicio incluye:
- Datum (revisión de antecedentes del cliente)
- Perfilamiento del cliente
- Elaboración del contrato
- Toma de fotografías y material audiovisual de ser necesario

Si te interesa, contestame por acá y coordinamos los próximos pasos.`
}

export function buildTemplateVariables(input: {
  advertiserName: string | null
  listingTitle:   string
  listingType:    "rent" | "sale" | null
}): Record<string, string> {
  const firstName = input.advertiserName?.split(/\s+/)[0]?.trim() || ""
  const commission = input.listingType === "rent"
    ? "Nuestra comisión por el servicio es el equivalente a un mes de renta."
    : input.listingType === "sale"
    ? "Nuestra comisión por el servicio es el 3% del precio de venta."
    : "Te confirmo la comisión por el servicio cuando me digas si te interesa avanzar."
  return {
    // The keys are integers as strings to match Twilio's
    // contentVariables convention ({{1}}, {{2}}, …).
    "1": firstName,
    "2": input.listingTitle,
    "3": commission,
  }
}

/**
 * E.164 normalization for phones the scraper extracts from E24.
 * Returns null when the input doesn't look like a real number.
 */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^0-9+]/g, "")
  if (!digits) return null
  if (digits.startsWith("+")) return digits.length >= 9 ? digits : null
  // 8 CR digits → assume +506 prefix
  if (digits.length === 8) return `+506${digits}`
  // 11 digits starting with 506 → add the +
  if (digits.length === 11 && digits.startsWith("506")) return `+${digits}`
  // Anything else with 9-15 digits — assume it already has country code
  if (digits.length >= 9 && digits.length <= 15) return `+${digits}`
  return null
}

async function getSearchRequestLeadId(
  admin:           AdminClient,
  searchRequestId: string,
): Promise<string> {
  const res = await admin
    .from("search_requests")
    .select("lead_id")
    .eq("id", searchRequestId)
    .single()
  if (res.error || !res.data?.lead_id) {
    throw new Error(`search_request ${searchRequestId} has no lead_id`)
  }
  return res.data.lead_id
}
