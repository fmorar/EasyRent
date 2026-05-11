"use client"

import { cn } from "@/lib/utils"

interface Option<T extends string | number> {
  value: T
  label: string
}

interface Props<T extends string | number> {
  label?:    string
  options:   Option<T>[]
  value:     T | null
  onChange:  (value: T | null) => void
  /** When true, clicking the selected chip clears the selection. */
  clearable?: boolean
  className?: string
}

/**
 * Lightweight chip-select used inside the public lead form. Optimized
 * for low friction — visitors can pick one of N options with a single
 * tap, OR clear by tapping the selected chip again (if `clearable`).
 *
 * Visual: pill buttons that wrap on mobile. Active chip = primary;
 * idle = outline. Designed to fit under tight contact-card real estate.
 */
export function LeadChipSelect<T extends string | number>({
  label, options, value, onChange, clearable = true, className,
}: Props<T>) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <p className="text-[11px] font-medium text-muted-foreground">{label}</p>}
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(active && clearable ? null : opt.value)}
              aria-pressed={active}
              className={cn(
                "h-7 px-2.5 rounded-full text-[11px] font-medium border transition-colors duration-(--duration-snap)",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-input hover:bg-muted",
              )}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
