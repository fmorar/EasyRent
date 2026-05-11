"use client"

import { useState } from "react"
import { ReviewerAvatar } from "@/components/project/reviewer-avatar"
import { StarIcon } from "@heroicons/react/24/solid"
import { cn } from "@/lib/utils"
import type { GoogleReview } from "@/lib/google-places"

interface Props {
  reviews:    GoogleReview[]
  /** Aggregate place rating (0-5). */
  rating?:    number
  /** Total review count on Google (not just the ones we display). */
  totalCount?: number
}

const VISIBLE_LIMIT = 4   // never show more than 4 reviewers in the rail
const QUOTE_LINES   = 8   // line-clamp on the featured quote body

/**
 * Editorial Google-reviews showcase for project pages.
 *
 *   ⊙ Diana                              "
 *     ★ 4.9 · 2 sem
 *
 *   ⊙ Lauren  ← active                 M i experiencia con el…
 *     ★ 5.0 · 1 mes                    "long reviews get clamped to
 *                                       N lines so the layout stays
 *   ⊙ Edward                            composed."
 *     ★ 4.5 · 3 sem
 *                                      — Lauren · ★ 5.0 · 1 mes
 *   ⊙ José
 *     ★ 4.0 · 6 mes
 *
 * Vertical left-aligned list (no decorative arc). Click any reviewer
 * to feature their quote on the right. Active row gets a slightly
 * larger avatar + bolder name + a leading hairline for emphasis.
 */
export function GoogleReviewsEditorial({ reviews, rating, totalCount }: Props) {
  const [activeIdx, setActiveIdx] = useState(0)
  if (reviews.length === 0) return null

  const visible = reviews.slice(0, VISIBLE_LIMIT)
  const active  = visible[activeIdx] ?? visible[0]

  // Drop-cap letter + tail
  const trimmed = (active.text ?? "").trim()
  const dropCap = trimmed.charAt(0)
  const tail    = trimmed.slice(1)

  return (
    <section
      aria-label="Reseñas en Google"
      className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-(--spacing-section) md:py-(--spacing-major)"
    >
      {/* Header — heading + meta */}
      <header className="mb-(--spacing-section)">
        <h2 className="text-xl sm:text-2xl font-heading font-bold tracking-tight">
          Reseñas{" "}
          <span className="text-foreground/40">de Google</span>
        </h2>
        {rating != null && (
          <p className="mt-(--spacing-tight) flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <StarIcon className="h-3.5 w-3.5 text-success" />
              <span className="font-semibold text-foreground font-numeric tabular-nums">
                {rating.toFixed(1)}
              </span>
            </span>
            <span className="text-foreground/30">·</span>
            <span>
              <span className="font-numeric tabular-nums">{totalCount ?? reviews.length}</span>
              {" "}reseñas
            </span>
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-(--spacing-section) lg:gap-(--spacing-major)">
        {/* ── Left rail · vertical list, left-aligned ─────────── */}
        <ol className="lg:col-span-5 space-y-(--spacing-block)">
          {visible.map((r, i) => {
            const isActive = i === activeIdx
            return (
              <li key={`${r.author_name}-${i}`}>
                <button
                  type="button"
                  onClick={() => setActiveIdx(i)}
                  aria-pressed={isActive}
                  className={cn(
                    "w-full flex items-center gap-(--spacing-cluster) text-left rounded-lg",
                    "transition-opacity duration-(--duration-state) ease-(--ease-out-quart)",
                    !isActive && "opacity-55 hover:opacity-90",
                  )}
                >
                  <ReviewerAvatar
                    src={r.profile_photo_url}
                    authorName={r.author_name}
                    className={cn(
                      "rounded-full object-cover shrink-0 ring-2 ring-background bg-card",
                      "transition-all duration-(--duration-state) ease-(--ease-out-quart)",
                      isActive ? "h-12 w-12" : "h-11 w-11",
                    )}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className={cn(
                      "font-heading tracking-tight leading-tight text-foreground",
                      "transition-all duration-(--duration-state) ease-(--ease-out-quart)",
                      isActive ? "text-base sm:text-lg font-bold" : "text-sm font-semibold",
                    )}>
                      {r.author_name}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <StarIcon className="h-3 w-3 text-success" />
                      <span className="font-numeric tabular-nums font-medium text-foreground">
                        {r.rating.toFixed(1)}
                      </span>
                      <span className="text-foreground/30">·</span>
                      <span className="truncate">{r.relative_time}</span>
                    </p>
                  </div>
                </button>
              </li>
            )
          })}
        </ol>

        {/* ── Right rail · featured quote in serif italic ───────── */}
        <blockquote className="lg:col-span-7">
          <span
            className="block text-5xl sm:text-6xl text-foreground/20 font-serif leading-none mb-2"
            aria-hidden
          >
            &ldquo;
          </span>

          {/* Long reviews are clamped so the right rail keeps a
              composed shape. The drop-cap floats left so line-clamp
              counts visible lines correctly. */}
          <p
            className="font-serif italic text-foreground leading-[1.7] text-base sm:text-lg max-w-prose overflow-hidden"
            style={{
              display:           "-webkit-box",
              WebkitBoxOrient:   "vertical",
              WebkitLineClamp:   QUOTE_LINES,
              lineClamp:         QUOTE_LINES,
            }}
          >
            <span
              className="float-left mr-2 text-5xl sm:text-6xl font-bold leading-[0.85] text-foreground"
              aria-hidden
            >
              {dropCap}
            </span>
            {tail}
          </p>

          <footer className="mt-(--spacing-block) flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground not-italic">
            <span className="text-foreground/40">—</span>
            <span className="font-medium text-foreground">{active.author_name}</span>
            <span className="text-foreground/30">·</span>
            <span className="inline-flex items-center gap-1">
              <StarIcon className="h-3 w-3 text-success" />
              <span className="font-numeric tabular-nums">{active.rating.toFixed(1)}</span>
            </span>
            <span className="text-foreground/30">·</span>
            <span>{active.relative_time}</span>
          </footer>
        </blockquote>
      </div>

      <p className="mt-(--spacing-section) text-xs text-muted-foreground">
        Reseñas vía Google Maps
      </p>
    </section>
  )
}
