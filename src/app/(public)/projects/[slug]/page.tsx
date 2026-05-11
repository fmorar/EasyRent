import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { MapPinIcon as MapPin, BuildingOffice2Icon as Building2 } from "@heroicons/react/24/outline"
import type { Metadata } from "next"
import type { Project } from "@/types"

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase  = await createClient()

  const { data } = await supabase
    .from("projects")
    .select("title, description")
    .eq("slug", slug)
    .eq("is_active", true)
    .single() as { data: Pick<Project, "title" | "description"> | null }

  if (!data) return {}

  return { title: data.title, description: data.description ?? undefined }
}

const STATUS_LABELS: Record<string, string> = {
  pre_launch:          "Pre-launch",
  under_construction:  "Under construction",
  completed:           "Completed",
  on_hold:             "On hold",
}

export default async function ProjectPublicPage({ params }: Props) {
  const { slug } = await params
  const supabase  = await createClient()

  const { data: project } = await supabase
    .from("projects")
    .select(`
      *,
      project_photos(url, type, is_cover, order_index, caption),
      project_amenities(name, icon, sort_order)
    `)
    .eq("slug", slug)
    .eq("is_active", true)
    .is("deleted_at", null)
    .single() as { data: Project & {
      project_photos: { url: string; type: string; is_cover: boolean; order_index: number; caption: string | null }[]
      project_amenities: { name: string; icon: string | null; sort_order: number }[]
    } | null }

  if (!project) notFound()

  const coverPhoto = project.project_photos?.find(
    (p: { is_cover: boolean; type: string }) => p.is_cover
  ) ?? project.project_photos?.[0]

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Cover */}
      <div className="aspect-video bg-muted rounded-xl overflow-hidden">
        {coverPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverPhoto.url} alt={project.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Building2 className="h-12 w-12" />
          </div>
        )}
      </div>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">{STATUS_LABELS[project.status] ?? project.status}</Badge>
          {"is_featured" in project && (project as {is_featured: boolean}).is_featured && <Badge>Featured</Badge>}
        </div>

        <h1 className="text-3xl font-bold">{project.title}</h1>

        {project.location_label && (
          <p className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {project.location_label}
          </p>
        )}

        {project.developer_name && (
          <p className="text-sm text-muted-foreground">
            Developer: <span className="font-medium text-foreground">{project.developer_name}</span>
          </p>
        )}

        <div className="flex gap-6 text-sm text-muted-foreground">
          {project.total_units && (
            <span>{project.total_units} total units</span>
          )}
          {project.available_units != null && (
            <span className="text-success font-medium">
              {project.available_units} available
            </span>
          )}
          {project.completion_date && (
            <span>Completion: {new Date(project.completion_date).toLocaleDateString("en-US", { year: "numeric", month: "long" })}</span>
          )}
        </div>
      </div>

      {project.description && (
        <div>
          <h2 className="font-semibold mb-2">About the project</h2>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {project.description}
          </p>
        </div>
      )}

      {/* Amenities */}
      {project.project_amenities?.length > 0 && (
        <div>
          <h2 className="font-semibold mb-3">Amenities</h2>
          <div className="flex flex-wrap gap-2">
            {project.project_amenities
              .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
              .map((amenity: { name: string; icon: string | null }) => (
                <Badge key={amenity.name} variant="outline">
                  {amenity.icon && <span className="mr-1">{amenity.icon}</span>}
                  {amenity.name}
                </Badge>
              ))}
          </div>
        </div>
      )}

      {/* Lead capture placeholder */}
      <div className="border rounded-lg p-6 bg-muted/30 space-y-2">
        <h2 className="font-semibold">Interested in this project?</h2>
        <p className="text-sm text-muted-foreground">
          Contact us to learn more or register your interest.
        </p>
        {/* TODO: Lead capture form component */}
      </div>
    </div>
  )
}
