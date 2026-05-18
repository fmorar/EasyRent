"use client"

// Tiny client island for the FeaturedProperties type-filter chips.
//
// Why this is split out of `featured-properties.tsx`:
//   • The card grid + section header are SERVER-rendered (cheaper TTFB
//     bundle, zero hydration cost for marketing copy that never moves)
//   • Only the chip row needs client JS — pressing a chip toggles a
//     CSS data attribute on a wrapper, which hides non-matching cards
//     via an attribute selector. No React re-render, no URL change,
//     no round-trip — just instant filter.
//
// This pattern is what lets the landing page ship dramatically less
// JS without losing the "tap a chip → see only houses" UX.

import { useState } from "react"
import { cn } from "@/lib/utils"

interface ChipDef {
  /** `""` is the special "All" pseudo-value (no filter applied). */
  value: string
  /** Localized label resolved server-side and passed in. */
  label: string
}

interface Props {
  chips:    ChipDef[]
  children: React.ReactNode
}

export function FeaturedPropertiesFilterChips({ chips, children }: Props) {
  const [active, setActive] = useState<string>("")

  return (
    <>
      {/* CSS rules driven by the wrapper's `data-active-filter` attr.
          When the active filter is "" (All) the rule contributes
          nothing — all cards stay visible by default. When a specific
          type is active we hide every card whose `data-property-type`
          doesn't match it (and unhide the matching ones, in case a
          previous render had marked them hidden).

          Scoped to .featured-properties-grid-wrapper so this style
          tag's selectors can't leak into other sections of the page. */}
      {active !== "" && (
        <style>{`
          .featured-properties-grid-wrapper[data-active-filter="${active}"]
            .featured-property-card:not([data-property-type="${active}"]) {
            display: none;
          }
        `}</style>
      )}

      {/* Chip row */}
      <div className="flex flex-wrap gap-2 mb-(--spacing-block)">
        {chips.map((chip) => {
          const isActive = active === chip.value
          return (
            <button
              key={chip.value || "all"}
              type="button"
              onClick={() => setActive(chip.value)}
              aria-pressed={isActive}
              className={cn(
                "rounded-full h-9 px-4 text-sm font-medium transition-colors whitespace-nowrap",
                isActive
                  ? "bg-foreground text-background"
                  : "border bg-background text-foreground/80 hover:bg-muted",
              )}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      {/* Grid wrapper carries the active filter. The grid + empty-state
          are passed in as `children` so they remain server-rendered.   */}
      <div
        className="featured-properties-grid-wrapper"
        data-active-filter={active}
      >
        {children}
      </div>
    </>
  )
}
