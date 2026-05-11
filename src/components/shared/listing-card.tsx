import Link from "next/link"
import { cn } from "@/lib/utils"

interface Props {
  /** Where the card navigates when clicked. */
  href:           string
  /** Image URL for the cover. Falls back to placeholder if null. */
  coverUrl?:      string | null
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
}

/**
 * Shared base for any "listing"-style card (property, project, etc).
 *
 * Defines the canonical look: rounded-2xl, no border, hover-shadow, aspect-[4/3]
 * cover with subtle scale-on-hover, and a body slot below.
 *
 * Body content rules (enforced via composition, not props):
 *  - Title + price on the same baseline-aligned row
 *  - Optional location line
 *  - <PropertySpecs> at the bottom
 *
 * The card is a single full-area <Link>; if your overlay needs interactive
 * children (e.g. a Share button), wrap them in a div with `onClick={stopPropagation}`
 * inside `photoOverlay`.
 */
export function ListingCardShell({
  href,
  coverUrl,
  coverAlt,
  aspectRatio = "4/3",
  photoOverlay,
  children,
  className,
  viewTransitionName,
}: Props) {
  const aspect = aspectRatio === "16/9" ? "aspect-video" : "aspect-[4/3]"

  return (
    <div className={cn("group relative cursor-pointer", className)}>
      {/* Whole card is one big link — covers photo + body. Overlay children
          (badges/share button) live above this layer with their own z-index
          and call e.stopPropagation() so they intercept clicks first. */}
      <Link
        href={href}
        className="absolute inset-0 z-0"
        aria-label={coverAlt}
      />

      {/* Photo owns the hover shadow + rounded corners. Keeping the shadow
          on the photo (not the whole card) avoids the body text feeling
          cramped against the shadow edge on hover. */}
      <div
        className={cn(
          "bg-muted relative overflow-hidden rounded-2xl",
          "ring-1 ring-foreground/5 group-hover:ring-foreground/10",
          "shadow-sm group-hover:shadow-xl transition-shadow duration-300",
          aspect,
        )}
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={coverAlt}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
            // `view-transition-name` lets the browser morph this exact
            // image element into the same-named element on the next
            // page (the property hero photo). Names must be unique in
            // the document, so we only set it when given (so a list of
            // 50 cards doesn't conflict with each other — the API
            // requires uniqueness on each page; the destination page
            // owns the same name on its hero img).
            style={
              viewTransitionName
                ? { viewTransitionName }
                : undefined
            }
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            Sin foto
          </div>
        )}
        {photoOverlay}
      </div>

      {/* Body — `pointer-events-none` lets clicks pass through to the
          absolute Link below. The wrapper is `cursor-pointer` so the user
          gets pointer feedback over body text too. */}
      <div className="pt-4 pb-1 space-y-1.5 relative z-10 pointer-events-none group-hover:[&_h3]:underline group-hover:[&_h3]:underline-offset-4 group-hover:[&_h3]:decoration-foreground/30">
        {children}
      </div>
    </div>
  )
}
