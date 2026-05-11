"use client"

import Link from "next/link"
import { useState, useMemo } from "react"
import { MarketplaceCard } from "@/components/property/marketplace-card"
import { buttonVariants } from "@/components/ui/button"
import { ArrowRightIcon } from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils"
import type { MarketplaceProperty } from "@/types"

interface Props {
  /** Latest N properties — passed in from the server (sorted by created_at desc). */
  properties:    MarketplaceProperty[]
  /** Map of `propertyId → coverUrl` from `property_photos`. */
  coverByProperty: Record<string, string | undefined>
}

const TYPE_FILTERS = [
  { value: "",           label: "Todas"        },
  { value: "house",      label: "Casa"         },
  { value: "apartment",  label: "Apartamento"  },
  { value: "land",       label: "Terreno"      },
  { value: "commercial", label: "Comercial"    },
] as const

/**
 * Featured-properties section for the landing.
 *
 * Server hands in the latest 6 marketplace-visible properties; the
 * client filters them by type via chips (purely client-side, no
 * round-trip — the server already gave us a small set). When the
 * filter narrows below the grid count, we just render fewer cards.
 *
 * "Ver todas" sends the user to /marketplace where the full-power
 * filter-bar lives. This section is conversion / discovery, not the
 * actual search tool.
 */
export function FeaturedProperties({ properties, coverByProperty }: Props) {
  const [filter, setFilter] = useState<string>("")

  const filtered = useMemo(() => {
    if (!filter) return properties
    return properties.filter((p) => p.property_type === filter)
  }, [filter, properties])

  return (
    <section
      aria-label="Propiedades destacadas"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-(--spacing-section) md:py-(--spacing-major)"
    >
      {/* ── Header — asymmetric: eyebrow/title left rail, copy + link offset right ── */}
      <header className="grid grid-cols-1 lg:grid-cols-12 gap-(--spacing-block) lg:gap-(--spacing-section) mb-(--spacing-section)">
        <div className="lg:col-span-7 space-y-(--spacing-cluster)">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Selección reciente
          </p>
          <h2
            className="font-heading font-bold tracking-tight leading-[1.05]"
            style={{ fontSize: "clamp(1.875rem, 4.5vw, 3.25rem)" }}
          >
            Propiedades{" "}
            <span className="text-foreground/40">recién publicadas</span>
          </h2>
        </div>
        <div className="lg:col-span-5 lg:pt-(--spacing-block) flex flex-col items-start gap-(--spacing-cluster) lg:items-end lg:text-right">
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm lg:max-w-none">
            Las últimas adiciones al portafolio. Filtros rápidos por tipo; para una búsqueda detallada, abrí el marketplace.
          </p>
          <Link
            href="/marketplace"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Ver todas
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* ── Type filter chips ─────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-(--spacing-block)">
        {TYPE_FILTERS.map((f) => {
          const isActive = filter === f.value
          return (
            <button
              key={f.value || "all"}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-full h-9 px-4 text-sm font-medium transition-colors whitespace-nowrap",
                // Public-surface active chip: ink pill (per the
                // dashboard-vs-public rule). Dashboard surfaces keep
                // their yellow primary chips; this is editorial.
                isActive
                  ? "bg-foreground text-background"
                  : "border bg-background text-foreground/80 hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {/* ── Grid ──────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-16 text-center space-y-3">
          <p className="text-sm font-medium">No hay propiedades de este tipo en la selección reciente.</p>
          <p className="text-xs text-muted-foreground">Probá otro tipo o explorá el marketplace completo.</p>
          <Link href="/marketplace" className={buttonVariants({ variant: "outline" })}>
            Ir al marketplace
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {filtered.map((p) => (
            <MarketplaceCard
              key={p.id}
              property={p}
              coverUrl={coverByProperty[p.id!]}
            />
          ))}
        </div>
      )}
    </section>
  )
}
