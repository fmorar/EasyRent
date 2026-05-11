import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getTranslations } from "next-intl/server"
import { LeadKanban } from "@/components/leads/lead-kanban"
import type { Lead } from "@/types"
import { PIPELINE_STAGES } from "@/lib/utils"

export default async function LeadsPage() {
  const { profile } = await requireAuth()
  const supabase    = await createClient()
  const isAdmin     = profile.role === "owner_admin"
  const t           = await getTranslations("leads")

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
    <div className="space-y-(--spacing-section)">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin ? t("allLeads") : t("myLeads")}
          </p>
        </div>
        <p className="text-sm text-muted-foreground font-numeric tabular-nums">
          {leads?.length ?? 0} {t("total")}
        </p>
      </div>

      <LeadKanban leadsByStage={leadsByStage} currentUserId={profile.id} />
    </div>
  )
}
