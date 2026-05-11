// Trust signals + commitments band. Two parts:
//   1. Stats strip (4 inline number-pairs)
//   2. Editorial split: left text rail + right visual feature cards
//      (replaces the old "3 pillars" copy block — show, don't tell).

import Link from "next/link"
import {
  ShieldCheckIcon,
  SparklesIcon,
  ArrowRightIcon,
  MapPinIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils"
import { StatsStrip } from "@/components/shared/stats-strip"
import { EasyrentLogo } from "@/components/shared/easyrent-logo"

const STATS = [
  { number: "+10",  label: "AÑOS\nEN BIENES RAÍCES" },
  { number: "+200", label: "PROPIEDADES\nVERIFICADAS" },
  { number: "+25",  label: "ZONAS EN EL\nGRAN ÁREA METROPOLITANA" },
  { number: "100%", label: "DOCUMENTACIÓN\nVALIDADA" },
]

export interface TrustSignalsProps {
  /** Optional featured project shown on the tilted card. Passed in
   *  from the landing page server query. When null, the tilted card
   *  renders a generic placeholder. */
  featuredProject?: {
    slug:           string
    title:          string
    cover_url:      string | null
    location_label: string | null
    total_units:    number | null
  } | null
}

export function TrustSignals({ featuredProject }: TrustSignalsProps = {}) {
  return (
    <section
      aria-label="Por qué elegirnos"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-(--spacing-section) md:py-(--spacing-major)"
    >
      {/* ── Numbers strip — shared component, also used on /projects/[slug] */}
      <div className="mb-(--spacing-major)">
        <StatsStrip stats={STATS} />
      </div>

      {/* ── Editorial split: text left + visual feature cards right ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-(--spacing-section) lg:gap-(--spacing-major) items-center">
        {/* Left rail — headline + subtitle + ink CTA */}
        <div className="lg:col-span-5 space-y-(--spacing-block)">
          <h2
            className="font-heading font-bold tracking-tight leading-[1.05] text-foreground"
            style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
          >
            Detrás de cada decisión,{" "}
            <span className="text-foreground/40">datos verificados</span>
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed max-w-md">
            Validamos folio real, comparamos precios con datos del mercado y te acompañamos con un asesor acreditado antes de cada visita.
          </p>
          <div>
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors duration-(--duration-state) ease-(--ease-out-quart)"
            >
              Ver propiedades
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Right visual — feature cards */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-5 gap-3 sm:gap-4">
          {/* Stacked left column (3 cols on sm+): AI card on top, Trust stat on bottom */}
          <div className="sm:col-span-3 space-y-3 sm:space-y-4">
            <AnalysisCard />
            <TrustStatCard />
          </div>

          {/* Tilted right column (2 cols on sm+) — full height project card */}
          <div className="sm:col-span-2">
            <TiltedProjectCard project={featuredProject ?? null} />
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Card 1 · AI / Análisis comparativo ────────────────────────────

function AnalysisCard() {
  return (
    <div className="rounded-2xl bg-card ring-1 ring-foreground/5 shadow-sm p-(--spacing-block) space-y-(--spacing-block)">
      {/* Brand row */}
      <div className="flex items-center justify-between">
        <EasyrentLogo className="h-3 w-auto text-foreground" />
        <span className="h-7 w-7 rounded-full bg-editorial-soft text-editorial flex items-center justify-center">
          <SparklesIcon className="h-3.5 w-3.5" />
        </span>
      </div>

      {/* Title */}
      <p className="text-base sm:text-lg font-heading font-semibold tracking-tight leading-snug">
        Análisis comparativo de zona con IA
      </p>

      {/* Mock input */}
      <div className="flex items-center gap-2 rounded-full border border-border bg-muted/40 pl-3 pr-1 py-1">
        <p className="text-xs text-muted-foreground flex-1 truncate">
          Pedí un análisis de Escazú…
        </p>
        <span className="inline-flex items-center h-7 px-3 rounded-full bg-foreground text-background text-[11px] font-medium shrink-0">
          Generar
        </span>
      </div>
    </div>
  )
}

// ── Card 2 · Trust stat (big number + icon) ───────────────────────

function TrustStatCard() {
  return (
    <div className="rounded-2xl bg-card ring-1 ring-foreground/5 shadow-sm p-(--spacing-block) flex items-start gap-(--spacing-cluster)">
      <span className="h-12 w-12 rounded-full bg-primary/15 text-foreground flex items-center justify-center shrink-0">
        <ShieldCheckIcon className="h-6 w-6" />
      </span>
      <div className="space-y-1">
        <p
          className="font-heading font-bold tracking-tight text-foreground font-numeric tabular-nums leading-none"
          style={{ fontSize: "clamp(1.875rem, 3.5vw, 2.5rem)", letterSpacing: "-0.02em" }}
        >
          100%
        </p>
        <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] text-muted-foreground leading-[1.35]">
          DOCUMENTACIÓN<br />VALIDADA
        </p>
      </div>
    </div>
  )
}

// ── Card 3 · Tilted project preview (right rail, full height) ─────

function TiltedProjectCard({
  project,
}: {
  project: TrustSignalsProps["featuredProject"]
}) {
  const inner = (
    <div
      className={cn(
        "h-full rounded-2xl bg-card ring-1 ring-foreground/10 shadow-md overflow-hidden",
        "transition-transform duration-(--duration-state) ease-(--ease-out-quart)",
        "transform-gpu rotate-[2deg] hover:rotate-0",
      )}
    >
      {/* Photo */}
      <div className="relative aspect-[3/4] overflow-hidden">
        {project?.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.cover_url}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-hero-fallback" />
        )}
        <span className="absolute top-3 right-3 inline-flex items-center h-6 px-2 rounded-full bg-background/90 backdrop-blur text-[10px] font-medium text-foreground shadow-sm">
          Proyecto
        </span>
      </div>

      {/* Caption */}
      <div className="p-(--spacing-cluster) space-y-(--spacing-tight)">
        <p className="text-sm font-heading font-semibold tracking-tight leading-tight truncate">
          {project?.title ?? "Proyecto destacado"}
        </p>
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <MapPinIcon className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {project?.location_label ?? "Gran Área Metropolitana"}
          </span>
        </p>
        {project?.total_units != null && (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <BuildingOffice2Icon className="h-3 w-3 shrink-0" />
            <span className="font-numeric tabular-nums">
              {project.total_units} {project.total_units === 1 ? "unidad" : "unidades"}
            </span>
          </p>
        )}
      </div>
    </div>
  )

  return project?.slug ? (
    <Link href={`/projects/${project.slug}`} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  )
}
