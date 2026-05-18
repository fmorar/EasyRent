// Asymmetric "latest projects" grid for the landing page.
//
// Server-rendered by default. When more than 3 projects exist a tiny
// client island (`FeaturedProjectsCarousel`) takes over to rotate
// the visible window via prev/next pagination. Below that threshold
// the section ships ZERO client JS for this block — the 1-3 cards
// render inline like any other server component.
//
//   ┌────────────────┐ ┌──────────┐ ┌──────────┐
//   │   ACTIVE       │ │  COMPACT │ │  COMPACT │
//   │   ── photo ─── │ │ ── photo │ │ ── photo │
//   │   ─────────── ┐│ │          │ │          │
//   │   info panel  ││ │ ▼dark    │ │ ▼dark    │
//   │   + rotated CTA│ │  band    │ │  band    │
//   └───────────────┘ └──────────┘ └──────────┘

import { getTranslations } from "next-intl/server"
import { FeaturedProjectsCarousel } from "@/components/landing/featured-projects-carousel"
import { ProjectCard, type FeaturedProjectCard } from "@/components/landing/featured-project-card"

// Re-export so existing imports (`import { FeaturedProjectCard }
// from "@/components/landing/featured-projects"`) still resolve.
export type { FeaturedProjectCard }

interface Props {
  projects: FeaturedProjectCard[]
}

export async function FeaturedProjects({ projects }: Props) {
  if (projects.length === 0) return null

  const t = await getTranslations("featuredProjects")

  // Precompute the developer-prefixed blurb here so the client island
  // never needs to call `useTranslations`. Functions can't cross the
  // server→client boundary, so we resolve the developer prefix to a
  // string per-card up front.
  const prepared = projects.map((p) => {
    const stripped = (p.description ?? "")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()
    const blurb = p.developer_name
      ? `${t("developerPrefix", { name: p.developer_name })} ${stripped}`
      : stripped
    return { project: p, blurb }
  })

  const moreInfoLabel = t("moreInfoPill")

  // ── ≤3 projects: pure server render, zero client JS ─────────────
  // The carousel state is meaningless when there's only one window —
  // skip the client island entirely and let the cards render inline.
  if (prepared.length <= 3) {
    return (
      <section
        aria-label={t("ariaLabel")}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-(--spacing-section) md:py-(--spacing-major)"
      >
        <header className="flex items-end justify-between gap-(--spacing-block) mb-(--spacing-section)">
          <div className="space-y-(--spacing-tight) max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {t("eyebrow")}
            </p>
            <h2
              className="font-heading font-bold tracking-tight leading-[1.05]"
              style={{ fontSize: "clamp(1.875rem, 4.5vw, 3.25rem)" }}
            >
              {t("headlinePrefix")}{" "}
              <span className="text-foreground/40">{t("headlineEmphasis")}</span>
            </h2>
          </div>
        </header>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-(--spacing-cluster) sm:gap-(--spacing-block)">
          {prepared.map(({ project, blurb }, i) => (
            <ProjectCard
              key={project.id}
              project={project}
              blurb={blurb}
              variant={i === 0 ? "active" : "compact"}
              moreInfoLabel={moreInfoLabel}
            />
          ))}
        </div>
      </section>
    )
  }

  // ── >3 projects: ship the carousel client island. Only the
  // paginators ship JS — the cards themselves are pure JSX in a
  // hook-free shared file (`featured-project-card.tsx`) so they
  // hydrate cheaply. ─
  return (
    <section
      aria-label={t("ariaLabel")}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-(--spacing-section) md:py-(--spacing-major)"
    >
      <FeaturedProjectsCarousel
        items={prepared}
        labels={{
          eyebrow:          t("eyebrow"),
          headlinePrefix:   t("headlinePrefix"),
          headlineEmphasis: t("headlineEmphasis"),
          prevProject:      t("prevProject"),
          nextProject:      t("nextProject"),
          moreInfoPill:     moreInfoLabel,
        }}
      />
    </section>
  )
}
