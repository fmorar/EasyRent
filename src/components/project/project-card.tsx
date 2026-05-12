"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowPathRoundedSquareIcon as GitFork,
  ShareIcon,
} from "@heroicons/react/24/outline"
import { ListingCardShell } from "@/components/shared/listing-card"
import { ShareProjectDialog } from "@/components/project/share-project-dialog"
import { ForkProjectButton } from "@/components/project/fork-project-button"
import { DownloadProjectPhotosButton } from "@/components/project/download-project-photos-button"
import { PROJECT_STATUS_LABELS } from "@/lib/labels"
import type { Project } from "@/types"

interface ProjectWithPhotos extends Project {
  project_photos?: { url: string; is_cover: boolean; order_index: number; type: string }[]
}

interface ProjectCardProps {
  project:       ProjectWithPhotos
  currentUserId: string
  isAdmin:       boolean
}

export function ProjectCard({ project, currentUserId, isAdmin }: ProjectCardProps) {
  const isOwner    = project.created_by === currentUserId
  const isFork     = !!project.forked_from
  const canShare   = isOwner && isFork && !project.is_master_template
  const canEdit    = isOwner || (isAdmin && project.is_master_template)
  const canFork    = !isOwner
  const coverPhoto = project.project_photos?.find((p) => p.is_cover)
    ?? project.project_photos?.sort((a, b) => a.order_index - b.order_index)[0]

  const href = canEdit ? `/projects/${project.slug}/edit` : `/projects/${project.slug}`

  return (
    <ListingCardShell
      href={href}
      coverUrl={coverPhoto?.url ?? null}
      coverAlt={project.title}
      photoOverlay={
        <>
          {/* Template / fork badges (top-left) */}
          <div className="absolute top-2 left-2 flex gap-1 z-10">
            {project.is_master_template && (
              <Badge className="text-xs bg-luxe text-white">Plantilla</Badge>
            )}
            {isFork && (
              <Badge variant="secondary" className="text-xs gap-1">
                <GitFork className="h-2.5 w-2.5" />
                Fork
              </Badge>
            )}
          </div>

          {/* Actions (top-right) */}
          <div
            className="absolute top-2 right-2 z-20 flex gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Download is available to anyone who can see the project —
                same rationale as on PropertyCard. Shows only when the
                project actually has photos to avoid an empty download. */}
            {(project.project_photos?.length ?? 0) > 0 && (
              <DownloadProjectPhotosButton
                projectId={project.id}
                projectSlug={project.slug}
              />
            )}
            {canShare && (
              <ShareProjectDialog
                projectId={project.id}
                projectTitle={project.title}
                projectSlug={project.slug}
                isPublic={project.is_public}
              >
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2 text-xs shadow-sm"
                >
                  <ShareIcon className="h-3.5 w-3.5 mr-1" />
                  Compartir
                </Button>
              </ShareProjectDialog>
            )}
            {canFork && (
              <ForkProjectButton projectId={project.id} projectTitle={project.title} />
            )}
          </div>
        </>
      }
    >
      {/* Status + featured */}
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline" className="text-xs">
          {PROJECT_STATUS_LABELS[project.status] ?? project.status}
        </Badge>
        {"is_featured" in project && (project as { is_featured: boolean }).is_featured && (
          <Badge className="text-xs">Featured</Badge>
        )}
      </div>

      {/* Title */}
      <h3 className="text-base font-heading font-semibold leading-tight truncate">
        {project.title}
      </h3>

      {/* Location + developer */}
      {(project.location_label || project.developer_name) && (
        <p className="text-xs text-muted-foreground truncate">
          {project.developer_name}
          {project.developer_name && project.location_label && " · "}
          {project.location_label}
        </p>
      )}

      {/* Units row */}
      {(project.total_units != null || project.available_units != null) && (
        <div className="flex gap-3 text-xs text-muted-foreground pt-2">
          {project.total_units != null && (
            <span className="font-numeric">{project.total_units} unidades</span>
          )}
          {project.available_units != null && (
            <span className="font-numeric text-success font-medium">
              {project.available_units} disponibles
            </span>
          )}
        </div>
      )}
    </ListingCardShell>
  )
}
