// Featured-properties section for the landing.
//
// Server-rendered shell + a tiny client island for the type-filter
// chips. Why split: before this change, the entire section was a
// "use client" component, which meant the 6 `MarketplaceCard`s + their
// `ListingCardShell` carousels + every `useTranslations` call hydrated
// on first paint — pure cost for a section whose only interactivity
// is "pick a type pill". The shell now renders fully on the server;
// only the chip row ships JS, and filtering is driven by a CSS
// attribute selector against `data-property-type` on each card. Zero
// re-render, zero round-trip.

import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { MarketplaceCard } from "@/components/property/marketplace-card"
import { buttonVariants } from "@/components/ui/button"
import { ArrowRightIcon } from "@heroicons/react/24/outline"
import { FeaturedPropertiesFilterChips } from "@/components/landing/featured-properties-filter-chips"
import { cn } from "@/lib/utils"
import type { MarketplaceProperty } from "@/types"

interface Props {
  /** Latest N properties — passed in from the server (sorted by created_at desc). */
  properties:    MarketplaceProperty[]
  /** Map of `propertyId → coverUrl` from `property_photos`. */
  coverByProperty: Record<string, string | undefined>
  /**
   * Map of `propertyId → full ordered photo list`. Optional — when
   * provided, each card on mobile renders a swipe carousel. When
   * absent, falls back to the single cover behaviour.
   */
  photosByProperty?: Record<string, Array<{ url: string; caption?: string | null }>>
}

// Type filter values map to property_type enum. Labels come from the
// shared `properties.types` namespace plus `featuredProperties.filterAll`.
const TYPE_FILTER_VALUES = ["", "house", "apartment", "land", "commercial"] as const

export async function FeaturedProperties({ properties, coverByProperty, photosByProperty }: Props) {
  const t      = await getTranslations("featuredProperties")
  const tTypes = await getTranslations("properties.types")

  // Build the chip definitions on the server so the client island only
  // needs labels + values. The "" pseudo-value maps to "All".
  const chips = TYPE_FILTER_VALUES.map((value) => ({
    value,
    label: value === "" ? t("filterAll") : tTypes(value),
  }))

  return (
    <section
      aria-label={t("ariaLabel")}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-(--spacing-section) md:py-(--spacing-major)"
    >
      {/* ── Header — asymmetric: eyebrow/title left rail, copy + link offset right ── */}
      <header className="grid grid-cols-1 lg:grid-cols-12 gap-(--spacing-block) lg:gap-(--spacing-section) mb-(--spacing-section)">
        <div className="lg:col-span-7 space-y-(--spacing-cluster)">
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
        <div className="lg:col-span-5 lg:pt-(--spacing-block) flex flex-col items-start gap-(--spacing-cluster) lg:items-end lg:text-right">
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm lg:max-w-none">
            {t("subheadline")}
          </p>
          <Link
            href="/marketplace"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            {t("viewAllCta")}
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* ── Filter chips + grid wrapper ─────────────────────────────
              The wrapper carries the active filter as a CSS attribute
              (`data-active-filter`). Cards advertise their own type via
              `data-property-type`. A scoped <style> tag inside the
              chip island hides cards that don't match — instant
              filter, zero re-render, zero round-trip. */}
      <FeaturedPropertiesFilterChips chips={chips}>
        {properties.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-16 text-center space-y-3">
            <p className="text-sm font-medium">{t("emptyHeadline")}</p>
            <p className="text-xs text-muted-foreground">{t("emptySubhead")}</p>
            <Link href="/marketplace" className={buttonVariants({ variant: "outline" })}>
              {t("emptyCta")}
            </Link>
          </div>
        ) : (
          // ── Grid ──────────────────────────────────────────────
          // Each card gets `data-property-type` so the chip island can
          // toggle visibility via an attribute selector. When the
          // active filter matches no card in the current 6, the user
          // simply sees an empty grid — acceptable here because the
          // landing only ever shows the 6 latest properties.
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {properties.map((p) => (
              <div
                key={p.id}
                data-property-type={p.property_type ?? ""}
                className="featured-property-card"
              >
                <MarketplaceCard
                  property={p}
                  coverUrl={coverByProperty[p.id!]}
                  photos={photosByProperty?.[p.id!]}
                />
              </div>
            ))}
          </div>
        )}
      </FeaturedPropertiesFilterChips>
    </section>
  )
}
