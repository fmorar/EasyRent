"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Squares2X2Icon } from "@heroicons/react/24/outline"
import { LightboxTrigger } from "@/components/ui/lightbox"
import { cn } from "@/lib/utils"

export interface GalleryPhoto {
  url:      string
  caption?: string | null
}

interface Props {
  photos:        GalleryPhoto[]
  /** Alt text used for the hero image. */
  alt?:          string
  /**
   * If provided, tiles render as `<button>`s firing this callback.
   * If omitted, tiles render as `<LightboxTrigger>`s — must then live
   * inside a `<LightboxProvider>`.
   */
  onPhotoClick?: (index: number) => void
  /**
   * Compact mode for narrow containers (e.g. dashboard preview pane).
   * Reduces grid height + tile padding.
   */
  compact?:      boolean
  /**
   * Pairs with the same name on a marketplace card to morph the cover
   * photo from the card into THIS gallery's hero on navigation. Pass
   * the property slug as `cover-{slug}`. Optional.
   */
  heroViewTransitionName?: string
  className?:    string
}

/**
 * Airbnb-style 5-photo grid:
 *
 *   ┌─────────────────────┬─────────┬─────────┐
 *   │                     │   2     │   3     │
 *   │       1 (hero)      ├─────────┼─────────┤
 *   │                     │   4     │   5     │
 *   └─────────────────────┴─────────┴─────────┘
 *
 * On mobile collapses to just the hero (the rest open via the lightbox
 * trigger or "Show all" button overlay on the bottom-right tile).
 *
 * The bottom-right tile shows a "Ver todas las fotos · N" pill whenever
 * there are >5 photos in the gallery.
 */
export function PropertyGallery({
  photos,
  alt = "",
  onPhotoClick,
  compact,
  heroViewTransitionName,
  className,
}: Props) {
  if (photos.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl bg-muted flex items-center justify-center text-muted-foreground text-sm",
          compact ? "h-52" : "aspect-[5/3]",
          className,
        )}
      >
        Sin fotos
      </div>
    )
  }

  const hero  = photos[0]
  const tiles = photos.slice(1, 5)         // up to 4 small tiles
  const extra = Math.max(0, photos.length - 5)

  // When fewer than 4 small tiles exist we pad with empty cells so the grid
  // doesn't collapse / re-flow.
  const empties = Math.max(0, 4 - tiles.length)

  return (
    <>
      {/* ── Mobile (< sm) — horizontal swipe carousel ──────────────
          One photo per viewport, snap-scroll between them. CSS-only
          gesture handling: no JS, no library, no jank. The
          `<MobileCarousel>` also wires an IntersectionObserver-based
          counter ("3 / 12") so the visitor knows where they are in
          the stack. */}
      <div
        className={cn(
          "sm:hidden relative rounded-xl overflow-hidden",
          compact ? "h-64" : "h-[280px]",
          className,
        )}
      >
        <MobileCarousel
          photos={photos}
          alt={alt}
          onClick={onPhotoClick}
          heroViewTransitionName={heroViewTransitionName}
        />
      </div>

      {/* ── Desktop (sm+) — Airbnb-style 5-tile grid ───────────── */}
      <div
        className={cn(
          "hidden sm:grid sm:gap-2 sm:rounded-xl sm:overflow-hidden",
          "sm:grid-cols-4 sm:grid-rows-2",
          compact ? "sm:h-72" : "sm:h-[480px]",
          className,
        )}
      >
        {/* Hero — full height on sm+, half width */}
        <Tile
          photo={hero}
          index={0}
          alt={alt}
          onClick={onPhotoClick}
          className="sm:col-span-2 sm:row-span-2"
          viewTransitionName={heroViewTransitionName}
        />

        {/* 4 small tiles */}
        {tiles.map((p, i) => {
          const realIndex = i + 1
          const isLast    = i === 3 || i === tiles.length - 1
          return (
            <Tile
              key={realIndex}
              photo={p}
              index={realIndex}
              alt={p.caption ?? ""}
              onClick={onPhotoClick}
              overlay={isLast && extra > 0 ? (
                <div className="absolute inset-0 bg-black/35 flex items-end justify-end p-2 pointer-events-none">
                  <span className="bg-white/95 text-foreground text-xs font-medium px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 shadow">
                    <Squares2X2Icon className="h-3.5 w-3.5" />
                    Ver todas · {photos.length}
                  </span>
                </div>
              ) : null}
            />
          )
        })}

        {/* Pad missing tiles so the grid keeps its shape. */}
        {Array.from({ length: empties }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="bg-muted"
          />
        ))}
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────
/**
 * Mobile-only horizontal carousel. Uses native scroll-snap so the
 * gesture (swipe / drag) is handled by the browser at 60fps — no
 * Motion / Embla / Swiper dependency, no jank, no JS thread cost.
 *
 * Each photo:
 *   • Fills the viewport width (snap-mandatory locks to one tile)
 *   • Is rendered as a <button> so a tap still opens the lightbox
 *     at the visible photo's index
 *   • Inherits `touch-action: pan-x` from the scroller so horizontal
 *     swipe always wins over button activation
 *
 * A small counter pill ("3 / 12") tracks position via an
 * IntersectionObserver — when a tile's visibility crosses 60%, it
 * becomes the "active" photo.
 */
function MobileCarousel({
  photos,
  alt,
  onClick,
  heroViewTransitionName,
}: {
  photos:  GalleryPhoto[]
  alt:     string
  onClick?: (index: number) => void
  heroViewTransitionName?: string
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  // Track which tile the visitor has swiped to. IntersectionObserver
  // is cheap and avoids touch / scroll listeners (which would force
  // synchronous layout reads on every swipe frame).
  useEffect(() => {
    const root = scrollerRef.current
    if (!root) return
    const tiles = Array.from(root.querySelectorAll<HTMLElement>("[data-photo-index]"))
    if (tiles.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio >= 0.6) {
            const idx = Number(entry.target.getAttribute("data-photo-index"))
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
    <>
      <div
        ref={scrollerRef}
        className={cn(
          "flex h-full w-full overflow-x-auto snap-x snap-mandatory",
          // Hide native scrollbar across engines. Webkit needs the
          // pseudo-element; Firefox uses scrollbar-width.
          "[&::-webkit-scrollbar]:hidden [scrollbar-width:none]",
          // Keep horizontal pans for the scroller, but let vertical
          // pans bubble up to the page scroll.
          "touch-pan-x overscroll-x-contain",
        )}
        // Improves momentum scrolling on iOS Safari.
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {photos.map((p, idx) => (
          <button
            key={idx}
            type="button"
            data-photo-index={idx}
            onClick={() => onClick?.(idx)}
            className="relative flex-none w-full h-full snap-start bg-muted"
            aria-label={p.caption ?? `Foto ${idx + 1} de ${photos.length}`}
          >
            <Image
              src={p.url}
              alt={p.caption ?? alt}
              fill
              // Hero (first slide) is the LCP element. Subsequent
              // tiles lazy-load — they're off-screen at first render.
              sizes="100vw"
              preload={idx === 0}
              fetchPriority={idx === 0 ? "high" : undefined}
              className="object-cover"
              // Pair this hero img with the marketplace card cover via
              // the View Transitions API. Only the first slide carries
              // the name (must be unique per document).
              data-parallax={idx === 0 && heroViewTransitionName ? "hero" : undefined}
              style={
                idx === 0 && heroViewTransitionName
                  ? { viewTransitionName: heroViewTransitionName }
                  : undefined
              }
            />
          </button>
        ))}
      </div>

      {/* Counter pill — pinned to the bottom-right with safe-area
          padding. font-numeric keeps tabular alignment as the index
          updates. */}
      {photos.length > 1 && (
        <span
          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-sm px-2.5 py-1 text-[11px] font-medium text-white font-numeric tabular-nums pointer-events-none"
          aria-live="polite"
        >
          {activeIdx + 1} / {photos.length}
        </span>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────
function Tile({
  photo,
  index,
  alt,
  onClick,
  className,
  overlay,
  viewTransitionName,
}: {
  photo:     GalleryPhoto
  index:     number
  alt:       string
  onClick?:  (index: number) => void
  className?: string
  overlay?:  React.ReactNode
  viewTransitionName?: string
}) {
  // The hero tile is the LCP element on the property page. We mark it
  // hot only when the tile owns a view-transition-name —
  // PropertyGallery sets that on the hero (index 0) and never on the
  // smaller tiles, so this is a clean signal without threading
  // another prop. Non-hero tiles get the default lazy-load behaviour.
  //
  // Next 16 deprecated `priority` — `preload` + `fetchPriority="high"`
  // is the supported way to (a) inject a <link rel="preload"> and
  // (b) set the img's fetchpriority attribute that browsers act on.
  const isHero = !!viewTransitionName
  const inner = (
    <>
      <Image
        src={photo.url}
        alt={alt}
        fill
        // Hero spans 2/4 cols on sm+, smaller tiles 1/4. On mobile
        // everything is full-width. Tells the optimizer to ship a
        // ~700px source on phones and a ~1100px source on desktop.
        sizes={
          isHero
            ? "(min-width: 640px) 50vw, 100vw"
            : "(min-width: 640px) 25vw, 100vw"
        }
        preload={isHero}
        fetchPriority={isHero ? "high" : undefined}
        className="object-cover transition-opacity duration-200 hover:opacity-95"
        // Pairs with the marketplace card's cover img — the browser
        // morphs that smaller image into this hero. Only the first
        // photo (index 0, the gallery hero) carries the name. The
        // hero img also opts into scroll-driven parallax via the
        // data attribute (see globals.css `[data-parallax="hero"]`).
        data-parallax={viewTransitionName ? "hero" : undefined}
        style={
          viewTransitionName
            ? { viewTransitionName }
            : undefined
        }
      />
      {overlay}
    </>
  )

  const baseCls = cn(
    "relative bg-muted cursor-zoom-in overflow-hidden",
    className,
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={() => onClick(index)}
        className={cn(baseCls, "block w-full h-full p-0")}
      >
        {inner}
      </button>
    )
  }

  return (
    <LightboxTrigger index={index} className={baseCls}>
      {inner}
    </LightboxTrigger>
  )
}
