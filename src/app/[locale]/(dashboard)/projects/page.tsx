import { requireAuth } from "@/lib/auth"
import { isAdminRole } from "@/lib/roles"
import { createClient } from "@/lib/supabase/server"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FolderOpenIcon, PlusIcon as Plus, ArrowPathRoundedSquareIcon as GitFork } from "@heroicons/react/24/outline"
import { ProjectCard } from "@/components/project/project-card"
import { EmptyState } from "@/components/shared/empty-state"
import type { Project } from "@/types"

export default async function ProjectsPage() {
  const { profile } = await requireAuth()
  const supabase    = await createClient()
  const isAdmin     = isAdminRole(profile.role)
  const t           = await getTranslations("projects")

  // Same scoping logic as /properties: show only projects the user created
  // or was shared on. Master templates are platform-wide blueprints so they
  // stay visible to everyone via the same OR clause.
  const { data: sharedRows } = await supabase
    .from("project_shares")
    .select("project_id")
    .eq("shared_with", profile.id)

  const sharedIds = (sharedRows ?? []).map((r) => r.project_id)
  const scopeParts = [
    `created_by.eq.${profile.id}`,
    `is_master_template.eq.true`,
    ...(sharedIds.length > 0 ? [`id.in.(${sharedIds.join(",")})`] : []),
  ]

  const { data: projectsRaw } = await supabase
    .from("projects")
    .select(`
      *,
      project_photos(url, is_cover, order_index, type)
    `)
    .or(scopeParts.join(","))
    .is("deleted_at", null)
    .order("is_master_template", { ascending: false })
    .order("created_at", { ascending: false })

  const projects = projectsRaw as Project[] | null

  const masterTemplates = projects?.filter((p) => p.is_master_template) ?? []
  const agentProjects   = projects?.filter((p) => !p.is_master_template) ?? []

  return (
    <div className="space-y-(--spacing-section)">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("subtitleAgent")}
          </p>
        </div>
        <Link href="/projects/new" className={buttonVariants()}>
          <Plus className="h-4 w-4 mr-2" />
          {t("new")}
        </Link>
      </div>

      {/* Master templates */}
      {masterTemplates.length > 0 && (
        <section className="space-y-(--spacing-cluster)">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("masterTemplates")}
            </h2>
            <Badge variant="outline" className="text-xs">{t("adminBadge")}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-(--spacing-cluster)">
            {masterTemplates.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                currentUserId={profile.id}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        </section>
      )}

      {/* Agent projects & forks */}
      <section className="space-y-(--spacing-cluster)">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {isAdmin ? t("agentProjects") : t("myProjects")}
          </h2>
          <GitFork className="h-3.5 w-3.5 text-muted-foreground" />
        </div>

        {!agentProjects.length ? (
          <EmptyState
            icon={<FolderOpenIcon className="h-8 w-8" />}
            message={isAdmin ? t("noProjectsAdmin") : t("noProjects")}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-(--spacing-cluster)">
            {agentProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                currentUserId={profile.id}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
