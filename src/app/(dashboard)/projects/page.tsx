import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PlusIcon as Plus, ArrowPathRoundedSquareIcon as GitFork } from "@heroicons/react/24/outline"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProjectCard } from "@/components/project/project-card"
import type { Project } from "@/types"

export default async function ProjectsPage() {
  const { profile } = await requireAuth()
  const supabase    = await createClient()
  const isAdmin     = profile.role === "owner_admin"

  const { data: projectsRaw } = await supabase
    .from("projects")
    .select(`
      *,
      project_photos(url, is_cover, order_index, type)
    `)
    .is("deleted_at", null)
    .order("is_master_template", { ascending: false })
    .order("created_at", { ascending: false })

  const projects = projectsRaw as Project[] | null

  const masterTemplates = projects?.filter((p) => p.is_master_template) ?? []
  const agentProjects   = projects?.filter((p) => !p.is_master_template) ?? []

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin
              ? "Master templates and all agent forks"
              : "Use a master template or manage your own projects"}
          </p>
        </div>
        <Link href="/projects/new" className={buttonVariants()}>
          <Plus className="h-4 w-4 mr-2" />
          New project
        </Link>
      </div>

      {/* Master templates */}
      {masterTemplates.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Master templates
            </h2>
            <Badge variant="outline" className="text-xs">Admin</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {isAdmin ? "Agent projects" : "My projects"}
          </h2>
          <GitFork className="h-3.5 w-3.5 text-muted-foreground" />
        </div>

        {!agentProjects.length ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No projects yet. Fork a master template or create a new one.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
