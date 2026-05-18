// Shared card markup for the FeaturedProjects section.
//
// Lives in its own file (no `"use client"`, no server-only imports)
// so it can be rendered from either the server shell (`featured-
// projects.tsx`) or the client-side carousel island (`featured-
// projects-carousel.tsx`). The component itself has zero hooks —
// it's pure JSX over its props — which makes it safe to import
// across the server/client boundary in this codebase.
//
// All copy is resolved upstream and handed in as plain strings; this
// file never calls `useTranslations` or `getTranslations`.

import Link from "next/link"
import Image from "next/image"
import {
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

export function ProjectCard({
  project, blurb, variant, moreInfoLabel,
}: {
  project:       FeaturedProjectCard
  /** Pre-formatted descriptive text (server pre-prefixes with the
   *  developer name when present). */
  blurb:         string
  variant:       "active" | "compact"
  /** Localised "Más info" pill copy — resolved upstream. */
  moreInfoLabel: string
}) {
  const href = `/projects/${project.slug}`

  return (
    <Link
      href={href}
      className={cn(
        "group relative rounded-2xl overflow-hidden ring-1 ring-foreground/5 hover:ring-foreground/15 hover:shadow-lg transition-all duration-(--duration-state) ease-(--ease-out-quart) aspect-[4/5] sm:aspect-[3/4] lg:aspect-[3/4]",
        variant === "compact" && "hidden lg:block",
      )}
    >
      {/* Photo (full bleed) — below-the-fold so we skip priority hints
          and let next/image lazy-load by default. */}
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

      {variant === "active"
        ? <ActiveOverlay project={project} blurb={blurb} moreInfoLabel={moreInfoLabel} />
        : <CompactOverlay project={project} />}
    </Link>
  )
}

// ── Active overlay — white info panel + rotated CTA pill ──────────

function ActiveOverlay({
  project, blurb, moreInfoLabel,
}: {
  project:       FeaturedProjectCard
  blurb:         string
  moreInfoLabel: string
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

      {/* Rotated dark pill — visual punctuation on desktop only. */}
      <div className="hidden sm:flex items-stretch shrink-0">
        <div className="m-2 px-2 rounded-full bg-foreground text-background flex items-center justify-center gap-1.5">
          <span
            className="text-[10px] uppercase tracking-[0.2em] font-medium whitespace-nowrap"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {moreInfoLabel}
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
