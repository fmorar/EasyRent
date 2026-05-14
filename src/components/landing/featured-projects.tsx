"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MapPinIcon,
  ArrowUpRightIcon,
} from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils"

export interface FeaturedProjectCard {
  id:              string
  slug:            string
  title:           string
  description:     string | null
  developer_name:  string | null
  location_label:  string | null
  total_units:     number | null
  available_units: number | null
  /** Cover photo URL — server resolves from `project_photos`. */
  cover_url:       string | null
}

interface Props {
  projects: FeaturedProjectCard[]
}

/**
 * Asymmetric "latest projects" carousel for the landing page.
 *
 *   ┌────────────────┐ ┌──────────┐ ┌──────────┐
 *   │   ACTIVE       │ │  COMPACT │ │  COMPACT │
 *   │   ── photo ─── │ │ ── photo │ │ ── photo │
 *   │   ─────────── ┐│ │          │ │          │
 *   │   info panel  ││ │ ▼dark    │ │ ▼dark    │
 *   │   + rotated CTA│ │  band    │ │  band    │
 *   └───────────────┘ └──────────┘ └──────────┘
 *
 * Active card = window[0]; prev/next rotates the window.
 * Below `lg`, only the active card renders.
 *
 * Each card links to `/projects/[slug]`. The rotated "Más info" pill is
 * a brand moment, not a separate target — the whole card is clickable.
 */
export function FeaturedProjects({ projects }: Props) {
  const [activeIdx, setActiveIdx] = useState(0)
  const total = projects.length

  // Visible window: 3 cards starting at activeIdx, wrapping. When the
  // collection is shorter than 3, just render what we have. The hook
  // must run on every render — empty-collection bail-out happens
  // AFTER the hook so we don't violate the rules of hooks.
  const visible: FeaturedProjectCard[] = useMemo(() => {
    if (total === 0) return []
    if (total <= 3) return projects
    return [
      projects[activeIdx % total],
      projects[(activeIdx + 1) % total],
      projects[(activeIdx + 2) % total],
    ]
  }, [activeIdx, projects, total])

  if (total === 0) return null

  const canPaginate = total > 3
  const prev = () => setActiveIdx((i) => (i - 1 + total) % total)
  const next = () => setActiveIdx((i) => (i + 1) % total)

  return (
    <section
      aria-label="Proyectos destacados"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-(--spacing-section) md:py-(--spacing-major)"
    >
      {/* Header — left-aligned title, paginators top-right */}
      <header className="flex items-end justify-between gap-(--spacing-block) mb-(--spacing-section)">
        <div className="space-y-(--spacing-tight) max-w-2xl">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Proyectos
          </p>
          <h2
            className="font-heading font-bold tracking-tight leading-[1.05]"
            style={{ fontSize: "clamp(1.875rem, 4.5vw, 3.25rem)" }}
          >
            Descubrí los proyectos{" "}
            <span className="text-foreground/40">más recientes</span>
          </h2>
        </div>

        {canPaginate && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={prev}
              aria-label="Proyecto anterior"
              className="h-10 w-10 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors duration-(--duration-state) ease-(--ease-out-quart)"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Siguiente proyecto"
              className="h-10 w-10 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors duration-(--duration-state) ease-(--ease-out-quart)"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </header>

      {/* Card row — desktop shows up to 3, mobile shows 1 (active only).
          The active one always sits in the leftmost slot. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-(--spacing-cluster) sm:gap-(--spacing-block)">
        {visible.map((p, i) => (
          <ProjectCard
            key={`${p.id}-${activeIdx}-${i}`}
            project={p}
            variant={i === 0 ? "active" : "compact"}
          />
        ))}
      </div>
    </section>
  )
}

// ── Card ──────────────────────────────────────────────────────────

function ProjectCard({
  project, variant,
}: {
  project: FeaturedProjectCard
  variant: "active" | "compact"
}) {
  const href = `/projects/${project.slug}`
  // Trim description to ~3 lines worth of body — the panel handles
  // overflow with line-clamp anyway, but stripping HTML keeps the
  // raw text safe for a clean preview.
  const blurb = (project.description ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
  const blurbWithDeveloper = project.developer_name
    ? `Desarrollado por ${project.developer_name}. ${blurb}`
    : blurb

  // Compact cards collapse on mobile so they don't compete with the
  // active card. We render the active everywhere; compact only on lg+.
  return (
    <Link
      href={href}
      className={cn(
        "group relative rounded-2xl overflow-hidden ring-1 ring-foreground/5 hover:ring-foreground/15 hover:shadow-lg transition-all duration-(--duration-state) ease-(--ease-out-quart) aspect-[4/5] sm:aspect-[3/4] lg:aspect-[3/4]",
        variant === "compact" && "hidden lg:block",
      )}
    >
      {/* Photo (full bleed) */}
      {project.cover_url ? (
        <Image
          src={project.cover_url}
          alt=""
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover transition-transform duration-(--duration-hero) ease-(--ease-out-expo) group-hover:scale-[1.03]"
        />
      ) : (
        <div className="absolute inset-0 bg-hero-fallback" />
      )}

      {variant === "active" ? <ActiveOverlay project={project} blurb={blurbWithDeveloper} /> : <CompactOverlay project={project} />}
    </Link>
  )
}

// ── Active overlay — white info panel + rotated CTA pill ──────────

function ActiveOverlay({
  project, blurb,
}: {
  project: FeaturedProjectCard
  blurb: string
}) {
  return (
    <div className="absolute inset-x-3 bottom-3 sm:inset-x-4 sm:bottom-4 rounded-xl bg-background/95 backdrop-blur shadow-sm flex">
      <div className="flex-1 min-w-0 p-(--spacing-cluster) sm:p-(--spacing-block) space-y-(--spacing-tight)">
        <h3 className="text-base sm:text-lg font-heading font-semibold tracking-tight leading-tight truncate">
          {project.title}
        </h3>
        {blurb && (
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-3">
            {blurb}
          </p>
        )}
        {project.location_label && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
            <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{project.location_label}</span>
          </p>
        )}
      </div>

      {/* Rotated dark pill — visual punctuation that anchors the panel
          on the right. On mobile we hide the pill (the whole card is
          tappable) so the info reads cleanly. */}
      <div className="hidden sm:flex items-stretch shrink-0">
        <div className="m-2 px-2 rounded-full bg-foreground text-background flex items-center justify-center gap-1.5">
          <span
            className="text-[10px] uppercase tracking-[0.2em] font-medium whitespace-nowrap"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Más información
          </span>
          <ArrowUpRightIcon className="h-3 w-3 shrink-0" />
        </div>
      </div>
    </div>
  )
}

// ── Compact overlay — dark band at bottom of photo ────────────────

function CompactOverlay({ project }: { project: FeaturedProjectCard }) {
  return (
    <>
      {/* Bottom dark gradient so text is readable over any photo */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

      <div className="absolute inset-x-0 bottom-0 p-(--spacing-cluster) sm:p-(--spacing-block) text-white space-y-1">
        <h3 className="text-base sm:text-lg font-heading font-semibold tracking-tight leading-tight line-clamp-1">
          {project.title}
        </h3>
        {project.location_label && (
          <p className="flex items-center gap-1.5 text-xs text-white/80">
            <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{project.location_label}</span>
          </p>
        )}
      </div>
    </>
  )
}
