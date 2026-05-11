"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { PerfHealthStatus } from "@/types"

interface Props {
  score:  number
  status: PerfHealthStatus
  /** Optional one-line explanation under the score. */
  explanation?: string
}

const STATUS_RING: Record<PerfHealthStatus, string> = {
  strong:          "text-success ring-success/30 bg-success-soft",
  healthy:         "text-info ring-info/30 bg-info-soft",
  needs_attention: "text-warning ring-warning/30 bg-warning-soft",
  low_activity:    "text-destructive ring-destructive/30 bg-destructive-soft",
}

/**
 * Big circular score chip + status label. Used as the hero card on
 * the dashboard detail and on the public owner report.
 *
 * Motion: the score number tweens from 0 to its final value over
 * ~600ms with ease-out-expo on first mount. This communicates "this
 * is computed live data" and gives the report a small signature
 * moment without distracting from the rest of the layout. Subsequent
 * mounts (e.g. when navigating back via Next router cache) skip the
 * tween — reduced-motion users skip it always.
 */
export function PerformanceHealthScore({ score, status, explanation }: Props) {
  const t = useTranslations("performanceReports.health")
  const display = useCountUp(score, 600)

  return (
    <Card>
      <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row items-center sm:items-start gap-5">
        <div
          className={cn(
            "h-24 w-24 sm:h-28 sm:w-28 rounded-full flex items-center justify-center ring-4 shrink-0",
            STATUS_RING[status],
          )}
        >
          <span className="text-3xl sm:text-4xl font-numeric font-bold tabular-nums">
            {display}
          </span>
        </div>
        <div className="flex-1 min-w-0 space-y-1.5 text-center sm:text-left">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Estado actual
          </p>
          <p className="text-base sm:text-lg font-heading font-semibold leading-tight">
            {t(status)}
          </p>
          {explanation && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {explanation}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Tween a number from 0 to `target` over `durationMs`, using
 * ease-out-expo. Honors `prefers-reduced-motion` (skips straight to
 * the final value). Target changes mid-flight restart the tween.
 */
function useCountUp(target: number, durationMs: number): string {
  // Whole numbers only — the score is 0-100 with at most one decimal,
  // but the tween reads cleaner as integers. Round at render.
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return target
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    return reduced ? target : 0
  })
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) {
      setValue(target)
      return
    }

    const start = performance.now()
    const from  = 0
    const to    = target
    // ease-out-expo: 1 - 2^(-10t)
    const eased = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      setValue(from + (to - from) * eased(t))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [target, durationMs])

  // Match the source format: integer if integral, else 1 decimal.
  return Number.isInteger(target)
    ? String(Math.round(value))
    : value.toFixed(1)
}
