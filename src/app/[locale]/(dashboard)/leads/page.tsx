import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { LeadKanban } from "@/components/leads/lead-kanban"
import { LeadsViewToggle } from "@/components/leads/leads-view-toggle"
import type { Lead } from "@/types"
import { PIPELINE_STAGES } from "@/lib/utils"

/**
 * Leads pipeline — "Tablero" view of the unified leads/conversations
 * surface. The toggle in the header swaps over to /conversations
 * (chat view) while keeping the same mental model: one funnel, two
 * ways to operate.
 *
 * Lives under `[locale]/(dashboard)/` so the next-intl-prefixed
 * sidebar Link (/es/leads, /en/leads) resolves here instead of the
 * non-locale `(dashboard)/leads/` duplicate.
 */
export default async function LeadsPage() {
  const { profile } = await requireAuth()
  const supabase    = await createClient()
  const isAdmin     = profile.role === "owner_admin"

  // RLS filters by assigned_to = me (or all for admin)
  const { data: leadsRaw } = await supabase
    .from("leads")
    .select(`
      *,
      property:properties(id, title, slug),
      assigned_profile:profiles!leads_assigned_to_fkey(id, full_name, avatar_url)
    `)
    .is("deleted_at", null)
    .eq("is_archived", false)
    .order("created_at", { ascending: false })

  const leads = leadsRaw as Lead[] | null

  // Lookup of WhatsApp conversation per lead, so cards can deep-link
  // straight into the chat thread. RLS already scopes by the same
  // visibility rules as the leads themselves.
  const leadIds = (leads ?? []).map((l) => l.id)
  const conversationsByLeadId: Record<string, string> = {}
  if (leadIds.length > 0) {
    const { data: convsRaw } = await supabase
      .from("conversations")
      .select("id, lead_id")
      .eq("channel", "whatsapp")
      .in("lead_id", leadIds)
    for (const c of convsRaw ?? []) {
      if (c.lead_id) conversationsByLeadId[c.lead_id] = c.id
    }
  }

  // Group by stage for kanban
  const leadsByStage = PIPELINE_STAGES.reduce(
    (acc, stage) => {
      acc[stage] = (leads ?? []).filter((l) => l.stage === stage)
      return acc
    },
    {} as Record<string, Lead[]>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-semibold">Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin ? "Todos los leads del embudo" : "Los leads asignados a vos"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            {leads?.length ?? 0} total
          </p>
          <LeadsViewToggle />
        </div>
      </div>

      <LeadKanban
        leadsByStage={leadsByStage}
        currentUserId={profile.id}
        conversationsByLeadId={conversationsByLeadId}
      />
    </div>
  )
}
