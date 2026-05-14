"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils"

interface Props {
  /** Where the card navigates when clicked. */
  href:           string
  /**
   * Single cover URL. Used as a fallback when `photos` isn't passed
   * (e.g. legacy callers, or cards that genuinely only have one photo).
   * When `photos` is set, this prop is ignored.
   */
  coverUrl?:      string | null
  /**
   * Full photo list for the mobile swipe carousel. Pass up to ~5 — we
   * cap inside this component to keep the upfront image budget sane.
   * On desktop only the first photo renders (single hero behavior).
   */
  photos?:        Array<{ url: string; caption?: string | null }>
  /** Alt text for the cover image. */
  coverAlt:       string
  /** Photo aspect ratio. Default 4:3 — matches marketing references. */
  aspectRatio?:   "4/3" | "16/9"
  /** Slot rendered absolutely on top of the cover (badges, share btn, etc.). */
  photoOverlay?:  React.ReactNode
  /** Body content rendered below the photo. */
  children:       React.ReactNode
  className?:     string
  /**
   * Stable id used to morph this card's cover photo into the same-named
   * element on the destination page via the View Transitions API. Pass
   * the property slug (e.g. `cover-{slug}`). Optional — when omitted,
   * the card navigates without a shared-element transition.
   */
  viewTransitionName?: string
  /**
   * Hints next/image to preload this image (injects a <link
   * rel="preload"> in <head>) and sets `fetchpriority="high"` on
   * the rendered <img>. Use only for above-the-fold cards — e.g.
   * the first 2-3 on the marketplace grid. Misusing it hurts LCP
   * for the cards that ARE above the fold.
   *
   * Implementation note: Next 16 deprecated the single `priority`
   * shorthand. We accept it on this shell to keep the API ergonomic
   * and translate to (`preload` + `fetchPriority`) internally.
   */
  priority?:           boolean
}

// Max slides per card carousel. Real listings often have 10-20 photos;
// shipping all of them on a /marketplace grid would balloon the image
// budget unnecessarily. Five is enough for "give the visitor a feel
// for the unit" — they can swipe more on the detail page.
const MAX_CAROUSEL_PHOTOS = 5

/**
 * Shared base for any "listing"-style card (property, project, etc).
 *
 * Defines the canonical look: rounded-2xl, no border, hover-shadow,
 * aspect-[4/3] cover with subtle scale-on-hover, and a body slot below.
 *
 * Mobile: when `photos.length > 1`, the photo area becomes a
 * horizontal swipe carousel using CSS scroll-snap. Each slide is a
 * native <Link>, so:
 *   • Tap → navigate to the detail page
 *   • Drag → browser interprets as scroll, no click fires
 * No carousel library, no Motion drag — 60fps native gestures.
 *
 * Desktop: single hero photo (the carousel collapses to one image).
 */
export function ListingCardShell({
  href,
  coverUrl,
  photos,
  coverAlt,
  aspectRatio = "4/3",
  photoOverlay,
  children,
  className,
  viewTransitionName,
  priority,
}: Props) {
  const aspect = aspectRatio === "16/9" ? "aspect-video" : "aspect-[4/3]"

  // Normalize the photo source: prefer the array; fall back to
  // coverUrl wrapped in a singleton. `hero` is always the first
  // photo — used for the desktop layout AND as the only mobile slide
  // when there's just one image.
  const normalizedPhotos = (photos && photos.length > 0)
    ? photos.slice(0, MAX_CAROUSEL_PHOTOS)
    : (coverUrl ? [{ url: coverUrl }] : [])
  const hero            = normalizedPhotos[0]
  const hasCarousel     = normalizedPhotos.length > 1

  return (
    <div className={cn("group cursor-pointer", className)}>
      {/* Photo owns the hover shadow + rounded corners. Photo-area
          links (full-cover Link on desktop, per-slide Links on mobile)
          live inside this wrapper so the carousel's touch scroller can
          absorb horizontal swipes without a parent button intercepting. */}
      <div
        className={cn(
          "bg-muted relative overflow-hidden rounded-2xl",
          "ring-1 ring-foreground/5 group-hover:ring-foreground/10",
          "shadow-sm group-hover:shadow-xl transition-shadow duration-300",
          aspect,
        )}
      >
        {hero ? (
          hasCarousel ? (
            <>
              {/* Mobile — swipe carousel */}
              <MobileCardCarousel
                photos={normalizedPhotos}
                href={href}
                coverAlt={coverAlt}
                priority={priority}
                viewTransitionName={viewTransitionName}
                className="sm:hidden"
              />
              {/* Desktop — hover-revealed arrow nav with cross-fade
                  between photos. Single Link still wraps every slide
                  so clicking anywhere on the photo navigates. */}
              <DesktopCardSlider
                photos={normalizedPhotos}
                href={href}
                coverAlt={coverAlt}
                priority={priority}
                viewTransitionName={viewTransitionName}
                className="hidden sm:block"
              />
            </>
          ) : (
            <Link
              href={href}
              aria-label={coverAlt}
              className="block absolute inset-0"
            >
              <SingleCover
                url={hero.url}
                alt={coverAlt}
                priority={priority}
                viewTransitionName={viewTransitionName}
              />
            </Link>
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            Sin foto
          </div>
        )}
        {photoOverlay}
      </div>

      {/* Body — its own Link wraps the content. Clicks on title/price
          navigate the same as clicks on the photo. The group-hover
          underline on h3 picks up hover state from anywhere in the
          card (photo or body), so the affordance is consistent. */}
      <Link
        href={href}
        className="block pt-4 pb-1 space-y-1.5 group-hover:[&_h3]:underline group-hover:[&_h3]:underline-offset-4 group-hover:[&_h3]:decoration-foreground/30"
        tabIndex={-1}
      >
        {children}
      </Link>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
/**
 * Desktop-only mini-slider. Hover over the card → left/right arrows
 * fade in over the photo edges; a small row of dot indicators sits
 * at the bottom. Click an arrow → cross-fade to the next/prev photo
 * (no navigation). Click anywhere else on the photo → goes to the
 * detail page like the single-cover variant.
 *
 * Render strategy: every photo lives in the DOM simultaneously,
 * stacked absolutely. Only the active one has `opacity-100`, the
 * rest are `opacity-0`. The browser preloads them all (we cap at
 * MAX_CAROUSEL_PHOTOS so this stays bounded), so navigation is
 * instant with no flicker.
 *
 * Note on view-transition-name: only photo 0 carries it. If the
 * visitor flips to photo 2 and then clicks, the morph-to-detail
 * animation doesn't fire — that's an acceptable degradation. The
 * alternative (re-binding the name to the active slide) would need
 * uniqueness coordination across N cards on the page.
 */
function DesktopCardSlider({
  photos,
  href,
  coverAlt,
  priority,
  viewTransitionName,
  className,
}: {
  photos:              Array<{ url: string; caption?: string | null }>
  href:                string
  coverAlt:            string
  priority?:           boolean
  viewTransitionName?: string
  className?:          string
}) {
  const [idx, setIdx] = useState(0)
  const hasMore = photos.length > 1

  // Wrap-around: stay on slide if there's nowhere to go (we hide the
  // arrow at the edges anyway, but this keeps state sane).
  const prev = () => setIdx((i) => (i > 0 ? i - 1 : i))
  const next = () => setIdx((i) => (i < photos.length - 1 ? i + 1 : i))

  return (
    <div className={cn("absolute inset-0", className)}>
      {/* The Link covers the whole photo area. Buttons + dots are
          siblings (not descendants), so their clicks don't bubble to
          the anchor. */}
      <Link
        href={href}
        aria-label={coverAlt}
        className="absolute inset-0 block"
      >
        {photos.map((p, i) => (
          <Image
            key={i}
            src={p.url}
            alt={i === idx ? coverAlt : ""}
            fill
            sizes="(min-width: 1024px) 33vw, 50vw"
            preload={priority && i === 0}
            fetchPriority={priority && i === 0 ? "high" : undefined}
            className={cn(
              "object-cover group-hover:scale-[1.03] transition-all duration-(--duration-state) ease-(--ease-out-quart)",
              i === idx ? "opacity-100" : "opacity-0 pointer-events-none",
            )}
            style={
              i === 0 && viewTransitionName
                ? { viewTransitionName }
                : undefined
            }
            // Hide background slides from assistive tech.
            aria-hidden={i !== idx}
          />
        ))}
      </Link>

      {hasMore && (
        <>
          {/* Left arrow */}
          {idx > 0 && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); prev() }}
              aria-label="Foto anterior"
              className={cn(
                "absolute left-2 top-1/2 -translate-y-1/2 z-10",
                "h-8 w-8 rounded-full bg-white/95 text-foreground shadow-md",
                "flex items-center justify-center",
                "opacity-0 group-hover:opacity-100 transition-opacity duration-(--duration-state) ease-(--ease-out-quart)",
                "hover:bg-white hover:scale-110",
              )}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
          )}

          {/* Right arrow */}
          {idx < photos.length - 1 && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); next() }}
              aria-label="Foto siguiente"
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 z-10",
                "h-8 w-8 rounded-full bg-white/95 text-foreground shadow-md",
                "flex items-center justify-center",
                "opacity-0 group-hover:opacity-100 transition-opacity duration-(--duration-state) ease-(--ease-out-quart)",
                "hover:bg-white hover:scale-110",
              )}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          )}

          {/* Dot indicators — small, brand-neutral, always visible so
              the visitor knows there's more even before they hover. */}
          <div
            className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 pointer-events-none"
            aria-hidden="true"
          >
            {photos.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-(--duration-state) ease-(--ease-out-quart)",
                  i === idx ? "w-4 bg-white" : "w-1.5 bg-white/55",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
function SingleCover({
  url,
  alt,
  priority,
  viewTransitionName,
}: {
  url:                 string
  alt:                 string
  priority?:           boolean
  viewTransitionName?: string
}) {
  return (
    <Image
      src={url}
      alt={alt}
      fill
      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
      preload={priority}
      fetchPriority={priority ? "high" : undefined}
      className="object-cover group-hover:scale-[1.03] transition-transform duration-500"
      style={viewTransitionName ? { viewTransitionName } : undefined}
    />
  )
}

// ─────────────────────────────────────────────────────────────────
/**
 * Mobile-only horizontal carousel inside a listing card. Each slide
 * is a Link to the detail page; the browser disambiguates tap vs
 * drag natively so we don't need a gesture library. A small counter
 * pill ("2 / 5") tracks position via IntersectionObserver.
 *
 * Image loading strategy:
 *   • Slide 1 — eager (with optional priority hint)
 *   • Slides 2-N — `loading="lazy"` so the browser defers them where
 *     it can. We cap the slide count at MAX_CAROUSEL_PHOTOS to keep
 *     the upfront image budget bounded even when the browser doesn't
 *     defer perfectly inside a horizontal scroller.
 */
function MobileCardCarousel({
  photos,
  href,
  coverAlt,
  priority,
  viewTransitionName,
  className,
}: {
  photos:              Array<{ url: string; caption?: string | null }>
  href:                string
  coverAlt:            string
  priority?:           boolean
  viewTransitionName?: string
  className?:          string
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  // IntersectionObserver instead of a scroll listener — cheaper and
  // doesn't force synchronous layout reads per frame. Threshold 0.6
  // gives a comfortable "snapped enough to count" feel.
  useEffect(() => {
    const root = scrollerRef.current
    if (!root) return
    const tiles = Array.from(root.querySelectorAll<HTMLElement>("[data-slide-idx]"))
    if (tiles.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio >= 0.6) {
            const idx = Number(entry.target.getAttribute("data-slide-idx"))
            if (!Number.isNaN(idx)) setActiveIdx(idx)
          }
        }
      },
      { root, threshold: [0.6] },
    )
    for (const t of tiles) observer.observe(t)
    return () => observer.disconnect()
  }, [photos.length])

  return (
    <div className={cn("absolute inset-0", className)}>
      <div
        ref={scrollerRef}
        className={cn(
          "flex h-full w-full overflow-x-auto snap-x snap-mandatory",
          "[&::-webkit-scrollbar]:hidden [scrollbar-width:none]",
          // Constrain horizontal pans to the carousel; vertical pans
          // still bubble up to the page so the user can scroll the
          // marketplace grid normally.
          "touch-pan-x overscroll-x-contain",
        )}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {photos.map((p, idx) => (
          <Link
            key={idx}
            href={href}
            data-slide-idx={idx}
            className="relative flex-none w-full h-full snap-start"
            aria-label={p.caption ?? coverAlt}
            // No prefetch on slides 2+ — the destination is the same
            // page either way, and prefetching once is enough.
            prefetch={idx === 0 ? undefined : false}
            tabIndex={idx === 0 ? 0 : -1}
          >
            <Image
              src={p.url}
              alt={p.caption ?? (idx === 0 ? coverAlt : "")}
              fill
              sizes="100vw"
              // Only the first slide gets the LCP hint. Off-screen
              // slides ship with loading="lazy" via next/image default.
              preload={idx === 0 && priority}
              fetchPriority={idx === 0 && priority ? "high" : undefined}
              className="object-cover"
              // Pair the hero slide with the marketplace card's source
              // photo on the detail page via the View Transitions API.
              // Names must be unique per document, so only slide 0
              // carries it.
              style={
                idx === 0 && viewTransitionName
                  ? { viewTransitionName }
                  : undefined
              }
            />
          </Link>
        ))}
      </div>

      {/* Counter pill — small, brand-neutral, doesn't compete with the
          status badge in the top corner. pointer-events-none so it
          never blocks the underlying Link's tap target. */}
      {photos.length > 1 && (
        <span
          className="absolute bottom-2 right-2 inline-flex items-center rounded-full bg-black/55 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-white font-numeric tabular-nums pointer-events-none z-10"
          aria-live="polite"
        >
          {activeIdx + 1} / {photos.length}
        </span>
      )}
    </div>
  )
}
