"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface FunnelStep {
  label: string
  value: number
}

interface Props {
  steps:    FunnelStep[]
  /** Optional className for the wrapping Card. */
  className?: string
}

/**
 * Horizontal-bar funnel. Each step renders as a row whose width is
 * proportional to `step.value / max`. The `max` is the first (largest)
 * step — usually total views. Pure CSS, no chart library.
 *
 * Motion: bars fill from 0% to their target width on mount, staggered
 * 60ms per row, 350ms each, ease-out-quart. The cascade communicates
 * the funnel relationship (each step is a subset of the previous) and
 * gives the eye a moment to land before the numbers settle.
 *
 * Reduced-motion: the global `prefers-reduced-motion` rule in
 * globals.css strips the transition; bars appear at full width.
 */
export function LeadFunnel({ steps, className }: Props) {
  const max = Math.max(...steps.map((s) => s.value), 1)
  // Hold widths at 0 on first render so the CSS transition can animate
  // them up. The effect flips `mounted` to true on the next frame.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <Card className={className}>
      <CardContent className="p-5 space-y-3">
        {steps.map((s, i) => {
          const pct = (s.value / max) * 100
          // First two rows pop with primary; the rest fade gradually
          const color = i === 0 ? "bg-primary"
                      : i === 1 ? "bg-primary/70"
                      :           "bg-primary/40"
          return (
            <div key={s.label} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-foreground/90">{s.label}</span>
                <span className="font-numeric tabular-nums font-semibold">
                  {s.value.toLocaleString("en-US")}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full", color)}
                  style={{
                    width: mounted ? `${Math.max(2, pct)}%` : "0%",
                    transitionProperty:       "width",
                    transitionDuration:       "var(--duration-reveal)",
                    transitionTimingFunction: "var(--ease-out-quart)",
                    transitionDelay:          `${i * 60}ms`,
                  }}
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
