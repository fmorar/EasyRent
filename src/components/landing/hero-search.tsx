import Link from "next/link"
import {
  ArrowRightIcon,
} from "@heroicons/react/24/outline"
import { MarketplaceFilterBar } from "@/components/marketplace/filter-bar"

export interface HeroProject {
  id:              string
  slug:            string
  title:           string
  description:     string | null
  developer_name:  string | null
  location_label:  string | null
  total_units:     number | null
  available_units: number | null
  cover_url:       string | null
  thumb_urls:      string[]
}

export interface HeroSearchProps {
  /** Distinct location strings (canton-level) for the location dropdown
   *  inside the marketplace filter bar. */
  locations: string[]
  /** Latest public project — its cover anchors the hero photo. */
  project?:  HeroProject | null
}

/**
 * Editorial hero — Horizon Estate-style.
 *
 *   ┌── max-w-7xl on cream bg ─────────────────────────┐
 *   │ Eyebrow                                          │
 *   │                                                  │
 *   │ Encontrá tu próximo                              │
 *   │ hogar con asesoría    ← headline left col        │
 *   │ verificada                                       │
 *   │                       ← subtitle right col       │
 *   │ [Coordinar visita →]  ← small ink CTA            │
 *   │                                                  │
 *   │ ┌─ contained project photo (rounded-3xl) ──┐    │
 *   │ │                                           │    │
 *   │ └───────────────────────────────────────────┘    │
 *   │                                                  │
 *   │ <MarketplaceFilterBar destinationPath="…" />     │
 *   └──────────────────────────────────────────────────┘
 *
 * Search controls are the SAME `<MarketplaceFilterBar>` component the
 * marketplace uses — picking a filter on the landing funnels the
 * visitor straight into `/marketplace?…` with the chosen filters
 * applied. Single source of truth for the filter UI.
 */
export function HeroSearch({ locations, project }: HeroSearchProps) {
  return (
    <section
      aria-label="Buscador principal"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-(--spacing-section) sm:pt-(--spacing-major) pb-(--spacing-section) sm:pb-(--spacing-major)"
    >
      {/* ── Editorial header — split: headline left, subtitle right ── */}
      <header className="grid grid-cols-1 lg:grid-cols-12 gap-(--spacing-block) lg:gap-(--spacing-section) mb-(--spacing-section) sm:mb-(--spacing-major)">
        <div className="lg:col-span-7 space-y-(--spacing-cluster)">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Casa Costa Rica · 2026
          </p>
          <h1
            className="font-heading font-bold tracking-tight leading-[0.98] text-foreground"
            style={{ fontSize: "clamp(2.25rem, 6vw, 5rem)" }}
          >
            Encontrá tu{" "}
            <span className="text-foreground/40">próximo hogar</span>
          </h1>
          <div className="pt-(--spacing-tight)">
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors duration-(--duration-state) ease-(--ease-out-quart)"
            >
              Coordinar visita
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="lg:col-span-5 lg:pt-(--spacing-block) flex items-end">
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-md">
            Documentación validada, asesores acreditados y acompañamiento legal antes de cada visita —{" "}
            <span className="font-semibold text-foreground">datos verificados</span>
            {" "}sobre las propiedades del Gran Área Metropolitana.
          </p>
        </div>
      </header>

      {/* ── Contained project photo ─────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden ring-1 ring-foreground/5 shadow-sm aspect-[16/10] sm:aspect-[16/8] lg:aspect-[16/7]">
        {project?.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.cover_url}
            alt={project.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-hero-fallback" />
        )}

        {/* Project anchor chip — small editorial tag bottom-left.
            Replaces the heavier glass-card overlay; keeps the
            featured project visible without dominating the photo. */}
        {project && (
          <Link
            href={`/projects/${project.slug}`}
            className="absolute bottom-(--spacing-cluster) left-(--spacing-cluster) sm:bottom-(--spacing-block) sm:left-(--spacing-block) inline-flex items-center gap-2 h-8 sm:h-9 pl-1.5 pr-3 rounded-full bg-background/95 backdrop-blur ring-1 ring-foreground/10 shadow-sm hover:bg-background transition-colors duration-(--duration-state) ease-(--ease-out-quart) max-w-[80%]"
          >
            <span className="inline-flex items-center h-6 px-2 rounded-full bg-foreground text-background text-[10px] uppercase tracking-[0.16em] font-medium shrink-0">
              Proyecto
            </span>
            <span className="text-xs sm:text-sm font-medium truncate min-w-0">
              {project.title}
            </span>
            {project.location_label && (
              <span className="hidden sm:inline text-xs text-muted-foreground truncate min-w-0">
                · {project.location_label}
              </span>
            )}
          </Link>
        )}
      </div>

      {/* ── Marketplace filter bar — single source of truth for the
              search UI. `destinationPath="/marketplace"` makes any
              filter change navigate the visitor to /marketplace with
              the chosen filters in the URL. */}
      <div className="mt-(--spacing-block) sm:mt-(--spacing-section)">
        <MarketplaceFilterBar
          locations={locations}
          destinationPath="/marketplace"
        />
      </div>
    </section>
  )
}
