import { getAmenityIcon } from "@/lib/amenity-icons"
import { translateAmenity } from "@/lib/amenity-translations"

interface Amenity {
  name: string
  /** Optional icon override (kept for forward compat — `getAmenityIcon`
   *  picks the right icon from the name in 95% of cases). */
  icon?: string | null
}

interface Props {
  amenities: Amenity[]
  /** Section heading (caller passes localized copy). */
  heading?:  string
  /** Current page locale. When omitted defaults to "es" (no translation). */
  locale?:   string
}

/**
 * Inline 2-column amenities grid — shared between the property and
 * project detail pages so the visual treatment matches.
 *
 *   ✓ Piscina           ✓ BBQ
 *   ✓ Gimnasio          ✓ Pet-friendly
 *   ✓ Cancha de tenis   ✓ Coworking
 *
 * Each row has a leading icon + name, separated by dashed hairlines.
 * Renders nothing when the list is empty.
 */
export function AmenitiesList({ amenities, heading = "Amenidades", locale = "es" }: Props) {
  if (!amenities || amenities.length === 0) return null

  return (
    <section className="space-y-(--spacing-cluster)">
      <h2 className="text-lg font-heading font-semibold">{heading}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-(--spacing-tight)">
        {amenities.map((a) => (
          <div
            key={a.name}
            className="flex items-center gap-2 text-sm py-1.5 border-b border-dashed last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0"
          >
            <span className="text-foreground shrink-0">
              {/* Icon resolution stays keyed by the source (ES) name so
                  the dictionary doesn't need to know about icons. */}
              {getAmenityIcon(a.name, "h-4 w-4")}
            </span>
            <span>{translateAmenity(a.name, locale)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
