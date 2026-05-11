"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import {
  PublicLeadEnrichmentSchema, computeInterestLevel,
  type PublicLeadEnrichment,
} from "@/lib/analytics/lead-schemas"
import type { ActionResult, Lead, LeadInsert, LeadStage } from "@/types"

interface PublicLeadInput {
  full_name:         string
  email?:            string
  phone?:            string
  message?:          string
  preferred_contact?:string
  source:            LeadInsert["source"]
  source_context?:   string
  property_id?:      string
  project_id?:       string
  anonymous_slug?:   string
  captured_by?:      string  // agent whose page generated the lead
  utm_source?:       string
  utm_medium?:       string
  utm_campaign?:     string
  referrer_url?:     string
  /** Optional structured enrichment fields collected from the form.
   *  Used to auto-compute the lead's interest_level and to surface
   *  signal in the owner performance report. */
  enrichment?:       PublicLeadEnrichment
}

// Used by public forms (no auth). Uses admin client to bypass RLS.
export async function capturePublicLead(
  input: PublicLeadInput
): Promise<ActionResult<{ id: string }>> {
  const admin = createAdminClient()

  // Validate the optional enrichment block. If it's malformed we don't
  // 500 the form — we just drop the enrichment and capture the lead.
  const enrichment = input.enrichment
    ? (PublicLeadEnrichmentSchema.safeParse(input.enrichment).data ?? {})
    : {}

  // Auto-compute interest_level from the enrichment answers.
  // Conservative heuristic — see lead-schemas.ts for the rules.
  const interestLevel = computeInterestLevel(enrichment)

  // Basic deduplication: check for same email + property in last 24h
  if (input.email && input.property_id) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: existing } = await admin
      .from("leads")
      .select("id")
      .eq("email",       input.email)
      .eq("property_id", input.property_id)
      .gt("created_at",  since)
      .limit(1)
      .single()

    if (existing) {
      return { success: true, data: { id: existing.id } }
    }
  }

  const { data, error } = await admin
    .from("leads")
    .insert({
      full_name:      input.full_name,
      email:          input.email ?? null,
      phone:          input.phone ?? null,
      notes:          input.message ?? null,
      source:         input.source,
      source_context: input.source_context ?? null,
      property_id:    input.property_id ?? null,
      project_id:     input.project_id ?? null,
      captured_by:    input.captured_by ?? null,
      assigned_to:    input.captured_by ?? null,
      stage:          "new",
      // Enrichment fields — all optional, only set when the form
      // collected an answer.
      inquiry_type:       enrichment.inquiry_type       ?? null,
      move_in_window:     enrichment.move_in_window     ?? null,
      has_pets:           enrichment.has_pets           ?? null,
      party_size:         enrichment.party_size         ?? null,
      budget_range:       enrichment.budget_range       ?? null,
      how_did_you_find:   enrichment.how_did_you_find   ?? null,
      preferred_visit_at: enrichment.preferred_visit_at ?? null,
      interest_level:     interestLevel,
    })
    .select("id")
    .single()

  if (error) return { success: false, error: error.message }

  // ── Fire AI extraction in the background ────────────────────────
  // The lead's `notes` field carries the form's `message`. If the
  // visitor wrote anything substantial, we hand it to the extraction
  // service so the next performance report aggregation has structured
  // questions/objections to work with.
  //
  // Fire-and-forget: we never block the lead capture on AI. If
  // OpenAI is slow, broken, or rate-limited, the lead still lands
  // safely. The extraction runs server-side and persists to
  // `leads.extracted_data` when it completes.
  if (input.message && input.message.trim().length >= 10) {
    void runExtractionInBackground(data.id)
  }

  return { success: true, data }
}

// Imports kept inside the function to avoid pulling the OpenAI client
// (~1MB) into bundles that don't need it (e.g. the kanban page).
async function runExtractionInBackground(leadId: string) {
  try {
    const { extractAndPersistLeadSignals } = await import(
      "@/lib/property-performance/ai-extraction-service"
    )
    await extractAndPersistLeadSignals(leadId)
  } catch (err) {
    // Swallow — non-critical, but log so Sentry catches systematic failures.
    console.error("[lead.extraction] failed for", leadId, err)
  }
}

// Optional metadata captured at the moment of a stage transition.
// The kanban surfaces a modal for transitions that benefit from this
// extra context (visit_scheduled, lost, contacted) — see the
// transition modal components for the UX.
export interface StageTransitionMeta {
  // → contacted
  contact_channel?:    "whatsapp" | "phone" | "email" | "in_person" | "other"
  contact_notes?:      string
  // → visit_scheduled
  appointment_at?:     string         // ISO datetime
  appointment_notes?:  string
  // → lost
  lost_reason?:
    | "price_too_high"     | "location_not_fit"        | "pets_not_allowed"
    | "insufficient_parking" | "move_in_date_mismatch" | "budget_too_low"
    | "rented_or_bought_elsewhere" | "unresponsive"   | "not_qualified"
    | "other"
  lost_notes?:         string
}

// Update pipeline stage — triggers DB history record automatically.
// Accepts optional metadata captured at the moment of transition (e.g.
// `lost_reason` when moving to `lost`). The metadata also gets folded
// into `notes` so the audit trail in `lead_status_history` is rich.
export async function updateLeadStage(
  leadId: string,
  stage:  LeadStage,
  meta?:  StageTransitionMeta,
): Promise<ActionResult<Lead>> {
  await requireAuth()
  const supabase = await createClient()

  // Build the partial update from the transition metadata. Only the
  // columns relevant to the target stage are set — we never null out
  // historical values (a lead that went `visit_scheduled → lost`
  // keeps its `appointment_at` for the timeline).
  const update: Record<string, unknown> = { stage }
  if (stage === "contacted") {
    if (meta?.contact_channel) update.contact_channel   = meta.contact_channel
    update.last_contacted_at = new Date().toISOString()
  }
  if (stage === "visit_scheduled" && meta?.appointment_at) {
    update.appointment_at     = meta.appointment_at
    update.appointment_status = "scheduled"
    if (meta.appointment_notes) update.appointment_notes = meta.appointment_notes
  }
  if (stage === "lost" && meta?.lost_reason) {
    update.lost_reason = meta.lost_reason
  }

  // Cast through `unknown` — Supabase's generated `Update` type is too
  // strict to accept a dynamic `Record<string, unknown>` build, but the
  // values we set above are all valid columns.
  const { data, error } = await supabase
    .from("leads")
    .update(update as unknown as never)
    .eq("id", leadId)
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath("/leads")
  return { success: true, data }
}

// Reassign lead to another agent (admin only)
export async function reassignLead(
  leadId:    string,
  agentId:   string
): Promise<ActionResult<Lead>> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  if (profile.role !== "owner_admin") {
    return { success: false, error: "Only admins can reassign leads" }
  }

  const { data, error } = await supabase
    .from("leads")
    .update({ assigned_to: agentId })
    .eq("id", leadId)
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath("/leads")
  return { success: true, data }
}

export async function archiveLead(leadId: string): Promise<ActionResult> {
  await requireAuth()
  const supabase = await createClient()

  const { error } = await supabase
    .from("leads")
    .update({ is_archived: true })
    .eq("id", leadId)

  if (error) return { success: false, error: error.message }

  revalidatePath("/leads")
  return { success: true, data: undefined }
}
