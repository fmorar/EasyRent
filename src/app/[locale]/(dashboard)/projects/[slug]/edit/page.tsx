import Link from "next/link"
import { notFound } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { ProjectEditClient } from "@/components/project/project-edit-client"
import { SaveFormButton } from "@/components/property/save-form-button"
import { ArrowLeftIcon } from "@heroicons/react/24/outline"
import { Badge } from "@/components/ui/badge"
import type { Project } from "@/types"
import { listProjectProperties } from "@/lib/actions/project-media.actions"
import type {
  ProjectAmenityRow,
  ProjectPhotoRow,
  ProjectFaqRow,
} from "@/lib/actions/project-media.actions"

const STATUS_LABELS: Record<string, string> = {
  pre_launch:         "Pre-lanzamiento",
  under_construction: "En construcción",
  completed:          "Completado",
  on_hold:            "En pausa",
}

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>
}) {
  const { slug }    = await params
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .is("deleted_at", null)
    .single()

  if (error || !project) notFound()

  const [
    { data: amenities },
    { data: photos },
    { data: faqs },
    linkedRes,
  ] = await Promise.all([
    supabase
      .from("project_amenities")
      .select("id, name, icon, sort_order")
      .eq("project_id", project.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("project_photos")
      .select("id, project_id, url, storage_path, type, is_cover, order_index, caption")
      .eq("project_id", project.id)
      .order("order_index", { ascending: true }),
    supabase
      .from("project_faqs")
      .select("id, project_id, question, answer, sort_order")
      .eq("project_id", project.id)
      .order("sort_order", { ascending: true }),
    listProjectProperties(project.id),
  ])
  const linkedProperties = linkedRes.success ? linkedRes.data : []

  return (
    // Bleed out of the dashboard's p-4 padding and fill viewport height minus header (64px)
    <div className="-mx-4 -mb-4 flex flex-col" style={{ height: "calc(100svh - 64px)" }}>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-3 border-b bg-background">
        <Link
          href="/projects"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Proyectos</span>
        </Link>
        <span className="text-muted-foreground/40 hidden sm:inline">/</span>
        <span className="text-sm font-medium truncate min-w-0">{project.title}</span>
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          <Badge variant="secondary" className="text-xs">
            {STATUS_LABELS[project.status] ?? project.status}
          </Badge>
          {project.is_master_template && (
            <Badge className="text-xs bg-luxe text-white">Plantilla</Badge>
          )}
          {project.forked_from && (
            <Badge variant="outline" className="text-xs">Fork</Badge>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
          {project.slug && (
            <Link
              href={`/projects/${project.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Ver página pública ↗
            </Link>
          )}
          <SaveFormButton formId="project-details-form" />
        </div>
      </div>

      {/* ── Split layout (client — live preview) ───────────── */}
      <ProjectEditClient
        mode="edit"
        profile={profile}
        project={project as Project}
        initialAmenities={(amenities ?? []) as ProjectAmenityRow[]}
        initialPhotos={(photos ?? []) as ProjectPhotoRow[]}
        initialFaqs={(faqs ?? []) as ProjectFaqRow[]}
        initialProperties={linkedProperties}
      />
    </div>
  )
}
