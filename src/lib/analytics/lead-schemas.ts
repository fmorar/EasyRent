// ============================================================
// Lead capture — Zod schemas (public + agent transitions)
//
// The public form schema mirrors the new enum-backed columns
// added to `leads` so the form, the action, the dashboard kanban
// and the AI summary all use the exact same vocabulary.
// ============================================================

import { z } from "zod"
import type {
  LeadInterestLevel, LeadInquiryType, LeadMoveInWindow,
  LeadPetsStatus, LeadBudgetRange,
} from "@/types"

// ── Enum schemas (kept in sync with the PG types) ───────────────

export const InquiryTypeSchema = z.enum(["availability", "visit", "info"])
export const MoveInWindowSchema = z.enum([
  "immediate", "one_month", "one_to_three_months",
  "three_to_six_months", "browsing",
])
export const PetsStatusSchema   = z.enum(["none", "small_dog", "large_dog", "cat", "multiple"])
export const BudgetRangeSchema  = z.enum([
  "under_1000", "between_1000_1500", "between_1500_2000",
  "between_2000_3000", "above_3000",
])
export const InterestLevelSchema = z.enum(["low", "medium", "high"])
export const ContactChannelSchema = z.enum(["whatsapp", "phone", "email", "in_person", "other"])
export const AppointmentStatusSchema = z.enum([
  "scheduled", "completed", "no_show", "cancelled", "pending",
])
export const LostReasonSchema = z.enum([
  "price_too_high", "location_not_fit", "pets_not_allowed",
  "insufficient_parking", "move_in_date_mismatch", "budget_too_low",
  "rented_or_bought_elsewhere", "unresponsive", "not_qualified", "other",
])

// ── Public lead form (extension of the existing capturePublicLead) ──
//
// All enrichment fields are OPTIONAL on the form — we never block a
// lead from being captured because they didn't pick a budget range.
// The agent can ask later if it matters.

export const PublicLeadEnrichmentSchema = z.object({
  inquiry_type:      InquiryTypeSchema.optional(),
  move_in_window:    MoveInWindowSchema.optional(),
  has_pets:          PetsStatusSchema.optional(),
  party_size:        z.number().int().min(1).max(20).optional(),
  budget_range:      BudgetRangeSchema.optional(),
  how_did_you_find:  z.string().max(64).optional(),
  preferred_visit_at: z.string().datetime().optional(),
})

export type PublicLeadEnrichment = z.infer<typeof PublicLeadEnrichmentSchema>

// ── Auto-cualification: derive interest_level from form answers ──
//
// Heuristic, deterministic, runs on lead create. The agent can
// override later by editing the lead. Conservative on purpose:
//   - HIGH only when intent + timing + budget all signal seriousness
//   - LOW only when the lead self-reports they're "just browsing"
//   - MEDIUM is the default
export function computeInterestLevel(input: PublicLeadEnrichment): LeadInterestLevel {
  const intent  = input.inquiry_type
  const timing  = input.move_in_window
  const hasBudget = input.budget_range != null

  // Strongest signal: the lead explicitly asked for a visit AND
  // wants to move in ≤1 month. That's high intent.
  if (intent === "visit" && (timing === "immediate" || timing === "one_month")) {
    return "high"
  }

  // Second-strongest: visit OR availability + serious-ish timing + budget
  if ((intent === "visit" || intent === "availability") &&
      (timing === "immediate" || timing === "one_month" || timing === "one_to_three_months") &&
      hasBudget) {
    return "high"
  }

  // Self-declared low intent
  if (intent === "info" && timing === "browsing") return "low"
  if (timing === "browsing" && !hasBudget)        return "low"

  return "medium"
}

// ── Agent-side lead transitions ────────────────────────────────
//
// One schema per kanban transition. The transition modal collects
// just the data needed to advance, no more.

export const TransitionToContactedSchema = z.object({
  contact_channel:  ContactChannelSchema,
  contact_notes:    z.string().max(2000).optional(),
})

export const TransitionToVisitScheduledSchema = z.object({
  appointment_at:    z.string().datetime(),
  appointment_notes: z.string().max(2000).optional(),
})

export const TransitionVisitOutcomeSchema = z.object({
  appointment_status: AppointmentStatusSchema,
  visit_feedback:     z.string().max(2000).optional(),
})

export const TransitionToLostSchema = z.object({
  lost_reason:   LostReasonSchema,
  lost_notes:    z.string().max(2000).optional(),
})

export type TransitionToContacted        = z.infer<typeof TransitionToContactedSchema>
export type TransitionToVisitScheduled   = z.infer<typeof TransitionToVisitScheduledSchema>
export type TransitionVisitOutcome       = z.infer<typeof TransitionVisitOutcomeSchema>
export type TransitionToLost             = z.infer<typeof TransitionToLostSchema>

// ── Re-exports of enum literal types so callers don't import twice ──
export type { LeadInterestLevel, LeadInquiryType, LeadMoveInWindow,
  LeadPetsStatus, LeadBudgetRange }
