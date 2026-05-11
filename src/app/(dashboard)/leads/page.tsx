import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { LeadKanban } from "@/components/leads/lead-kanban"
import type { Lead } from "@/types"
import { PIPELINE_STAGES } from "@/lib/utils"

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin ? "All pipeline leads" : "Your assigned leads"}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {leads?.length ?? 0} total
        </p>
      </div>

      <LeadKanban leadsByStage={leadsByStage} currentUserId={profile.id} />
    </div>
  )
}
