"use client"

import { Badge } from "@/components/ui/badge"
import {
  MapPinIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline"
import { getAmenityIcon } from "@/lib/amenity-icons"
import type { Project } from "@/types"
import type { ProjectPhotoRow } from "@/lib/actions/project-media.actions"

const STATUS_LABELS: Record<string, string> = {
  pre_launch:         "Pre-lanzamiento",
  under_construction: "En construcción",
  completed:          "Completado",
  on_hold:            "En pausa",
}

interface Props {
  project:   Project
  amenities: string[]
  photos:    ProjectPhotoRow[]
}

/**
 * Compact preview that mirrors the public project page (`/projects/<slug>`).
 * Designed for a ~480px-wide sidebar — same layout/sections as the live page,
 * scaled down so the editor can see exactly what publishers will see.
 */
export function ProjectPreview({ project, amenities, photos }: Props) {
  const sorted    = [...photos].sort((a, b) => a.order_index - b.order_index)
  const heroPhoto = sorted.find((p) => p.is_cover) ?? sorted[0]
  const gallery   = sorted.filter((p) => p !== heroPhoto).slice(0, 4)
  const totalPhotos = sorted.length

  const totalUnits     = project.total_units ?? 0
  const availableUnits = project.available_units ?? 0
  const completionTxt  = project.completion_date
    ? new Date(project.completion_date).toLocaleDateString("es-CR", { year: "numeric", month: "short" })
    : null

  return (
    <div className="text-sm">

      {/* Notice */}
      <div className="mx-4 mt-4 mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/60 border border-dashed text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-warning shrink-0" />
        Vista previa · se actualiza en tiempo real
      </div>

      {/* ─── HERO ───────────────────────────────────────────── */}
      <section className="relative h-64 overflow-hidden">
        {heroPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroPhoto.url}
            alt={project.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center">
            <BuildingOffice2Icon className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />

        <div className="relative z-10 h-full flex flex-col justify-end p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-px w-6 bg-white/40" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
              {STATUS_LABELS[project.status] ?? project.status}
            </span>
            {project.developer_name && (
              <>
                <span className="text-white/40">·</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80 truncate">
                  {project.developer_name}
                </span>
              </>
            )}
          </div>

          <h1 className="text-xl font-heading font-bold text-white leading-tight tracking-tight line-clamp-2">
            {project.title || "Título del proyecto"}
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-white/80 text-[11px]">
            {project.location_label && (
              <span className="flex items-center gap-1 truncate max-w-[260px]">
                <MapPinIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">{project.location_label}</span>
              </span>
            )}
            {completionTxt && <span>Entrega · <span className="font-numeric">{completionTxt}</span></span>}
            {totalUnits > 0 && <span><span className="font-numeric">{totalUnits}</span> unidades</span>}
          </div>

          {project.is_master_template && (
            <Badge className="absolute top-3 left-3 bg-luxe text-white text-[10px]">Plantilla</Badge>
          )}
        </div>
      </section>

      {/* ─── STATS ──────────────────────────────────────────── */}
      <section className="border-y">
        <div className="grid grid-cols-3 divide-x divide-border">
          <Stat number={totalUnits || "—"}    label="Unidades"   />
          <Stat number={availableUnits}        label="Disponibles" highlight />
          <Stat number={completionTxt ?? "—"} label="Entrega"     small />
        </div>
      </section>

      {/* ─── GALLERY ────────────────────────────────────────── */}
      {gallery.length > 0 && (
        <section className="px-5 pt-5">
          <div className="grid grid-cols-3 gap-1.5 h-28">
            {gallery.slice(0, 3).map((p, i) => (
              <div key={i} className="bg-muted rounded-lg overflow-hidden relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.caption ?? project.title}
                  className="w-full h-full object-cover"
                />
                {i === 2 && totalPhotos > 4 && (
                  <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                    <span className="text-white text-sm font-semibold">+{totalPhotos - 4}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── ABOUT ──────────────────────────────────────────── */}
      {project.description && (
        <section className="px-5 pt-6 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
            El proyecto
          </p>
          <h2 className="text-lg font-heading font-bold tracking-tight mb-3">Sobre la propiedad</h2>
          <div
            className="preview-prose text-xs leading-relaxed text-muted-foreground line-clamp-6"
            dangerouslySetInnerHTML={{ __html: project.description }}
          />
        </section>
      )}

      {/* ─── AMENITIES ──────────────────────────────────────── */}
      {amenities.length > 0 && (
        <section className="px-5 pt-6 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
            Lo que ofrece
          </p>
          <h2 className="text-lg font-heading font-bold tracking-tight mb-4">Amenidades</h2>
          <ul className="grid grid-cols-2 gap-y-2">
            {amenities.slice(0, 10).map((a) => (
              <li key={a} className="flex items-center gap-2 text-xs">
                <span className="h-6 w-6 rounded-full bg-primary/15 text-foreground flex items-center justify-center shrink-0">
                  {getAmenityIcon(a, "h-3 w-3")}
                </span>
                <span className="truncate">{a}</span>
              </li>
            ))}
            {amenities.length > 10 && (
              <li className="col-span-2 text-[10px] text-muted-foreground italic mt-1">
                +{amenities.length - 10} más
              </li>
            )}
          </ul>
        </section>
      )}

      {/* ─── CTA placeholder ────────────────────────────────── */}
      <section className="m-5 mt-8 rounded-xl bg-muted/40 border p-5 text-center space-y-2">
        <BuildingOffice2Icon className="h-6 w-6 mx-auto text-muted-foreground" />
        <p className="text-sm font-semibold">¿Te interesa este proyecto?</p>
        <p className="text-[10px] text-muted-foreground">
          En la página pública aparece el formulario de contacto del agente.
        </p>
      </section>
    </div>
  )
}

// ── Stat tile ─────────────────────────────────────────────────────
function Stat({
  number, label, highlight, small,
}: {
  number:    string | number
  label:     string
  highlight?: boolean
  small?:    boolean
}) {
  return (
    <div className="px-4 py-4">
      <p
        className={`font-numeric font-bold leading-none mb-1 ${
          small ? "text-base" : "text-xl"
        } ${highlight ? "text-success" : ""}`}
      >
        {number}
      </p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
    </div>
  )
}
