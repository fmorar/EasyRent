"use client"

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
    <div
      className={cn(
        "grid gap-2 rounded-xl overflow-hidden",
        "grid-cols-1 sm:grid-cols-4 sm:grid-rows-2",
        compact ? "h-64 sm:h-72" : "h-[280px] sm:h-[480px]",
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
            // Hide on mobile — only the hero shows there.
            className="hidden sm:block"
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
          className="bg-muted hidden sm:block"
        />
      ))}
    </div>
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
  const inner = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={alt}
        className="w-full h-full object-cover transition-opacity duration-200 hover:opacity-95"
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
