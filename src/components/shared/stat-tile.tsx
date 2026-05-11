import { cn } from "@/lib/utils"

interface Props {
  number:    string | number
  label:     string
  /** Apply primary color to the number (e.g. for the highlighted metric). */
  highlight?: boolean
  /** Apply emerald color (success / available count). */
  success?:  boolean
  /** Apply muted style for secondary metrics. */
  muted?:    boolean
  /** Smaller number font (for date strings etc. that aren't really numbers). */
  small?:    boolean
  /** Custom border classes — used to compose dividers in stat groups. */
  className?: string
}

/**
 * Shared metric tile — used in dashboards, public pages, and admin queues.
 *
 *   ┌─────────────────┐
 *   │ 247             │  ← number (font-numeric, big)
 *   │ UNIDADES        │  ← label (uppercase, tracking-wide)
 *   └─────────────────┘
 */
export function StatTile({
  number, label, highlight, success, muted, small, className,
}: Props) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card px-4 sm:px-5 py-3 sm:py-4",
        muted && "opacity-70",
        className,
      )}
    >
      <p
        className={cn(
          "font-numeric font-bold leading-none mb-1.5 sm:mb-2",
          small
            ? "text-xl sm:text-2xl"
            : "text-2xl sm:text-3xl",
          highlight && "text-foreground",
          success && "text-success",
        )}
      >
        {number}
      </p>
      <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
    </div>
  )
}
