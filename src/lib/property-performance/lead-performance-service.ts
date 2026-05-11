// ============================================================
// Lead aggregator — funnel + status breakdown + privacy-safe
// summaries that the public report can render.
//
// Privacy: the redacted `OwnerSafeLead[]` is what the OpenAI
// service receives. The model NEVER sees full names, phones,
// emails, or internal notes.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import type {
  LeadFunnelAggregate, OwnerSafeLead, QuestionsObjections,
} from "./types"
import type {
  Lead, LeadInterestLevel, LeadLostReason,
} from "@/types"

interface AggregateInput {
  property_id: string
  period_start: string | null
  period_end:   string | null
}

export async function aggregateLeadPerformance(
  supabase: SupabaseClient<Database>,
  input:    AggregateInput,
): Promise<{ funnel: LeadFunnelAggregate; owner_leads: OwnerSafeLead[] }> {
  let query = supabase
    .from("leads")
    .select("*")
    .eq("property_id", input.property_id)
    .is("deleted_at", null)
    .eq("is_archived", false)
    .order("created_at", { ascending: false })

  if (input.period_start) query = query.gte("created_at", input.period_start)
  if (input.period_end)   query = query.lte("created_at", input.period_end)

  const { data, error } = await query.limit(2000)
  if (error) throw new Error(`leads fetch failed: ${error.message}`)

  const rows = (data ?? []) as Lead[]
  return {
    funnel:      computeFunnel(rows),
    owner_leads: rows.slice(0, 25).map(toOwnerSafe),
  }
}

function computeFunnel(rows: Lead[]): LeadFunnelAggregate {
  const total = rows.length
  let qualified = 0, contacted = 0
  let appointments = 0, completed = 0, no_show = 0, cancelled = 0
  let offers = 0, closed = 0, lost = 0

  // Stage breakdown
  const byStage = new Map<string, number>()
  // Interest breakdown
  const byInterest = new Map<LeadInterestLevel, number>()
  // Source breakdown
  const bySource = new Map<string, number>()
  // Lost reason breakdown
  const byLostReason = new Map<LeadLostReason, number>()

  for (const l of rows) {
    byStage.set(l.stage, (byStage.get(l.stage) ?? 0) + 1)
    byInterest.set(l.interest_level, (byInterest.get(l.interest_level) ?? 0) + 1)
    bySource.set(l.source, (bySource.get(l.source) ?? 0) + 1)

    if (l.stage !== "new")  contacted++
    if (l.interest_level === "high" || ["interested", "visit_scheduled", "negotiating", "contract_requested"].includes(l.stage)) qualified++
    if (l.appointment_at)   appointments++
    if (l.appointment_status === "completed") completed++
    if (l.appointment_status === "no_show")   no_show++
    if (l.appointment_status === "cancelled") cancelled++
    if (l.stage === "negotiating" || l.stage === "contract_requested") offers++
    if (l.stage === "closed") closed++
    if (l.stage === "lost") {
      lost++
      if (l.lost_reason) byLostReason.set(l.lost_reason, (byLostReason.get(l.lost_reason) ?? 0) + 1)
    }
  }

  const ratio = (a: number, b: number) =>
    b === 0 ? 0 : Math.round((a / b) * 1000) / 1000

  return {
    total_leads:            total,
    qualified_leads:        qualified,
    contacted_leads:        contacted,
    appointments_scheduled: appointments,
    visits_completed:       completed,
    visits_no_show:         no_show,
    visits_cancelled:       cancelled,
    offers_received:        offers,
    closed_leads:           closed,
    lost_leads:             lost,
    conversion_rate:        0, // computed at orchestrator level (needs total_views)
    qualified_conversion:   ratio(qualified,      total),
    appointment_rate:       ratio(appointments,   qualified),
    visit_completion_rate:  ratio(completed,      appointments),
    leads_by_stage:    [...byStage.entries()].map(([stage, count]) => ({ stage, count })),
    leads_by_interest: [...byInterest.entries()].map(([level, count]) => ({ level, count })),
    leads_by_source:   [...bySource.entries()].map(([source, count]) => ({ source, count })),
    lost_reasons:      [...byLostReason.entries()].map(([reason, count]) => ({ reason, count })),
  }
}

// ── Owner-facing redaction ─────────────────────────────────────
//
// Strips PII to the minimum the owner needs to recognize lead
// activity:
//   - Full name → "Maria G." (first word + initial of second word)
//   - No phone, no email, no notes
//   - Stage / interest / source / public_summary survive
//
// The public RPC enforces the same redaction at the SQL layer —
// this function exists so the OpenAI service receives the same
// safe shape (defense in depth).
function toOwnerSafe(lead: Lead): OwnerSafeLead {
  const parts = lead.full_name.trim().split(/\s+/)
  const first = parts[0] ?? "—"
  const rest  = parts[1] ? ` ${parts[1].charAt(0).toUpperCase()}.` : ""

  return {
    label:              `${first}${rest}`,
    stage:              lead.stage,
    interest_level:     lead.interest_level,
    source:             lead.source,
    public_summary:     lead.public_summary,
    appointment_at:     lead.appointment_at,
    appointment_status: lead.appointment_status,
    created_at:         lead.created_at,
  }
}

// ── Aggregate questions / objections from extracted_data ───────
//
// `extracted_data` is the AI extraction output stored on each lead.
// This function rolls up across all leads in the period to find the
// most common questions and objections — the "what are people asking?"
// section of the owner report.
export function aggregateQuestionsObjections(rows: Lead[]): QuestionsObjections {
  const qBuckets = new Map<string, number>()
  const oBuckets = new Map<string, number>()
  const sentiment = { positive: 0, neutral: 0, negative: 0 }
  const urgencyMap: Record<string, number> = { high: 1, medium: 0.5, low: 0 }
  let urgencyTotal = 0
  let urgencyCount = 0

  for (const l of rows) {
    const x = l.extracted_data as
      | { questions?: string[]; objections?: string[]; sentiment?: keyof typeof sentiment; urgency?: keyof typeof urgencyMap }
      | null
    if (!x) continue
    for (const q of x.questions  ?? []) qBuckets.set(q, (qBuckets.get(q) ?? 0) + 1)
    for (const o of x.objections ?? []) oBuckets.set(o, (oBuckets.get(o) ?? 0) + 1)
    if (x.sentiment && x.sentiment in sentiment) sentiment[x.sentiment]++
    if (x.urgency && x.urgency in urgencyMap) {
      urgencyTotal += urgencyMap[x.urgency]
      urgencyCount++
    }
  }

  return {
    top_questions:  [...qBuckets.entries()].map(([category, count]) => ({ category, count }))
                      .sort((a, b) => b.count - a.count).slice(0, 8),
    top_objections: [...oBuckets.entries()].map(([category, count]) => ({ category, count }))
                      .sort((a, b) => b.count - a.count).slice(0, 8),
    sentiment_breakdown: sentiment,
    avg_urgency: urgencyCount === 0 ? 0 : Math.round((urgencyTotal / urgencyCount) * 100) / 100,
  }
}
