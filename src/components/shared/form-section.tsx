import { cn } from "@/lib/utils"

interface Props {
  /** Section anchor — used by the TOC on desktop. */
  id?:           string
  /** Numbered indicator (e.g. "1", "2"…). Optional. */
  number?:       string | number
  /** Section heading. */
  title:         string
  /** One-liner explanation under the heading. */
  description?:  React.ReactNode
  /** Marks the section as optional (renders an "Opcional" pill). */
  optional?:    boolean
  /** Extra header content rendered to the right of the title (e.g. a toggle). */
  headerAction?: React.ReactNode
  /** Body content. */
  children:     React.ReactNode
  className?:   string
}

/**
 * Reusable wrapper for form sections.
 *
 *   ┌─────────────────────────────────────────┐
 *   │ ① Section title         [headerAction] │
 *   │   Optional one-line description         │
 *   ├─────────────────────────────────────────┤
 *   │ ▏ form fields…                          │
 *   └─────────────────────────────────────────┘
 *
 * Visual rules
 * ────────────
 * - Card-style container with padding for visual grouping (Gestalt proximity).
 * - Numbered circle + heading establish hierarchy.
 * - "Opcional" pill on the right of the heading reduces friction.
 * - Body uses `space-y-4` rhythm internally — children are responsible for
 *   their own grids.
 *
 * Pair with `FormSectionGroup` (the outer scrollable wrapper) for big forms.
 */
export function FormSection({
  id,
  number,
  title,
  description,
  optional,
  headerAction,
  children,
  className,
}: Props) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-2xl border bg-card p-4 sm:p-5 space-y-4 scroll-mt-24",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {number != null && (
            <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold font-numeric flex items-center justify-center shrink-0">
              {number}
            </span>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-heading font-semibold leading-tight">
                {title}
              </h2>
              {optional && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground border rounded-full px-1.5 py-0.5 bg-muted/40">
                  Opcional
                </span>
              )}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>

        {headerAction && (
          <div className="shrink-0">{headerAction}</div>
        )}
      </header>

      <div className="space-y-3">
        {children}
      </div>
    </section>
  )
}
