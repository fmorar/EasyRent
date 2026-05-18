"use client"

// Client island for FeaturedProjects when there are more than 3
// projects to rotate through. Renders the header + prev/next paginators
// + the visible window of cards.
//
// We deliberately keep the surface tiny:
//   • Card markup lives in ProjectCard (server-friendly — no hooks),
//     imported from the parent module and re-rendered here as React
//     output. Re-importing it from a "use client" file is allowed
//     because the component itself is hook-free.
//   • All copy is pre-resolved by the server and handed in as plain
//     strings on `labels`. The blurb is pre-prefixed with the
//     developer name. No client `useTranslations`, no function props.

import { useMemo, useState } from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline"
import {
  ProjectCard,
  type FeaturedProjectCard,
} from "@/components/landing/featured-project-card"

export interface FeaturedProjectsCarouselItem {
  project: FeaturedProjectCard
  blurb:   string
}

interface Labels {
  eyebrow:          string
  headlinePrefix:   string
  headlineEmphasis: string
  prevProject:      string
  nextProject:      string
  moreInfoPill:     string
}

interface Props {
  items:  FeaturedProjectsCarouselItem[]
  labels: Labels
}

export function FeaturedProjectsCarousel({ items, labels }: Props) {
  const total = items.length
  const [activeIdx, setActiveIdx] = useState(0)

  // 3-card window starting at activeIdx, wrapping around the end.
  const visible: FeaturedProjectsCarouselItem[] = useMemo(() => {
    return [
      items[activeIdx % total],
      items[(activeIdx + 1) % total],
      items[(activeIdx + 2) % total],
    ]
  }, [activeIdx, items, total])

  const prev = () => setActiveIdx((i) => (i - 1 + total) % total)
  const next = () => setActiveIdx((i) => (i + 1) % total)

  return (
    <>
      <header className="flex items-end justify-between gap-(--spacing-block) mb-(--spacing-section)">
        <div className="space-y-(--spacing-tight) max-w-2xl">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {labels.eyebrow}
          </p>
          <h2
            className="font-heading font-bold tracking-tight leading-[1.05]"
            style={{ fontSize: "clamp(1.875rem, 4.5vw, 3.25rem)" }}
          >
            {labels.headlinePrefix}{" "}
            <span className="text-foreground/40">{labels.headlineEmphasis}</span>
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={prev}
            aria-label={labels.prevProject}
            className="h-10 w-10 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors duration-(--duration-state) ease-(--ease-out-quart)"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label={labels.nextProject}
            className="h-10 w-10 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors duration-(--duration-state) ease-(--ease-out-quart)"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-(--spacing-cluster) sm:gap-(--spacing-block)">
        {visible.map(({ project, blurb }, i) => (
          <ProjectCard
            key={`${project.id}-${activeIdx}-${i}`}
            project={project}
            blurb={blurb}
            variant={i === 0 ? "active" : "compact"}
            moreInfoLabel={labels.moreInfoPill}
          />
        ))}
      </div>
    </>
  )
}
