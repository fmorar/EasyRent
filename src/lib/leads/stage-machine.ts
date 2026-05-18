import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Database } from "@/types/supabase"

type LeadStage = Database["public"]["Enums"]["lead_stage"]

/**
 * Monotonic stage advancement for leads.
 *
 * The bot fires this from several event hooks (first outbound,
 * profile enrichment, owner-acceptance) with a SUGGESTED stage.
 * The helper compares ranks and only writes when the suggested
 * stage is FURTHER along the funnel than the current one — so
 * an out-of-order signal never moves a lead backward.
 *
 * `lost` is treated as terminal-ish: once a lead is lost, the bot
 * will NOT auto-revive them. Manual operator action (drag back in
 * the kanban, or the eventual `mark_as_active` lead action) is the
 * only way out. `closed` is also locked because re-opening a won
 * lead is a deliberate decision, not a side-effect of new messages.
 */

const STAGE_RANK: Record<LeadStage, number> = {
  new:                0,
  contacted:          1,
  interested:         2,
  visit_scheduled:    3,
  negotiating:        4,
  contract_requested: 5,
  closed:             6,
  // 'lost' is OFF the linear funnel — handled separately.
  lost:               99,
}

const TERMINAL_STAGES: ReadonlySet<LeadStage> = new Set(["lost", "closed"])

export interface AdvanceResult {
  advanced: boolean
  from:     LeadStage
  to:       LeadStage
  reason?:  string
}

/**
 * Advance the lead's funnel position when (and only when) the
 * suggested stage is strictly further than the current one.
 *
 * Idempotent on rank: calling it twice with the same suggested
 * stage is a no-op the second time. That's the property we rely on
 * to call this freely from event hooks without worrying about
 * "already-contacted" leads being touched again on every webhook.
 */
export async function maybeAdvanceLeadStage(args: {
  leadId:    string
  suggested: LeadStage
  /** Optional human-readable trigger; logged when an advance fires
   *  so the audit trail in Vercel logs is greppable. */
  reason?:   string
}): Promise<AdvanceResult> {
  const admin = createAdminClient()
  const cur = await admin
    .from("leads")
    .select("stage")
    .eq("id", args.leadId)
    .single()
  if (cur.error || !cur.data) {
    return { advanced: false, from: args.suggested, to: args.suggested }
  }
  const from = cur.data.stage as LeadStage
  if (TERMINAL_STAGES.has(from)) {
    return { advanced: false, from, to: from }
  }
  const currentRank = STAGE_RANK[from] ?? 0
  const newRank     = STAGE_RANK[args.suggested] ?? 0
  if (newRank <= currentRank) {
    return { advanced: false, from, to: from }
  }

  const upd = await admin
    .from("leads")
    .update({ stage: args.suggested })
    .eq("id", args.leadId)
  if (upd.error) {
    return { advanced: false, from, to: from }
  }

  console.log(
    `[stage] lead=${args.leadId} ${from} → ${args.suggested}${args.reason ? ` (${args.reason})` : ""}`,
  )
  return { advanced: true, from, to: args.suggested, reason: args.reason }
}

/**
 * Look at the lead's enrichment state and decide if it now qualifies
 * for the `interested` stage.
 *
 *   Signal of interest = any ONE of:
 *     - inquiry_type set (lead explicitly stated what they want)
 *     - budget_range set (they shared a number)
 *     - preferred_zones populated (told us where)
 *     - move_in_window set
 *
 * One signal is enough — these are the fields the agent's
 * update_lead_profile tool captures and each one represents an
 * active conversation that's beyond a cold hello.
 *
 * Called from updateLeadFromAgent after every successful write so
 * the funnel reflects reality in near-real-time.
 */
export async function maybeAdvanceFromProfileSignals(leadId: string): Promise<void> {
  const admin = createAdminClient()
  const res = await admin
    .from("leads")
    .select("inquiry_type, budget_range, move_in_window, extracted_data")
    .eq("id", leadId)
    .single()
  if (res.error || !res.data) return

  const extracted = res.data.extracted_data as { preferred_zones?: unknown } | null
  const zones = Array.isArray(extracted?.preferred_zones) ? extracted!.preferred_zones : []
  const hasInterest =
    !!res.data.inquiry_type ||
    !!res.data.budget_range ||
    !!res.data.move_in_window ||
    zones.length > 0

  if (hasInterest) {
    await maybeAdvanceLeadStage({
      leadId,
      suggested: "interested",
      reason:    "profile-signal",
    })
  }
}
