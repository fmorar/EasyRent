"use client"

import { cn } from "@/lib/utils"

interface Props {
  title:        string
  description?: React.ReactNode
  checked:      boolean
  onChange:     () => void
  disabled?:    boolean
}

/**
 * Title + description on the left, toggle switch on the right.
 *
 * Use inside `<FormSection>` for boolean settings (visibility, public flags,
 * notification preferences, etc.). Replaces ad-hoc `flex justify-between`
 * blocks scattered across forms.
 */
export function ToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled,
}: Props) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-3">
      <div className="space-y-0.5 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        onClick={onChange}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
          checked ? "bg-primary" : "bg-input",
        )}
      >
        <span
          className={cn(
            "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-sm ring-0 transition-transform duration-200",
            checked ? "translate-x-4" : "translate-x-0",
          )}
        />
      </button>
    </div>
  )
}
