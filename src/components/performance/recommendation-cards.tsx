"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Step {
  title:       string
  description: string
  priority:    "low" | "medium" | "high"
}

interface Props {
  steps: Step[]
  title?: string
}

const PRIORITY_RANK: Record<Step["priority"], number> = { high: 0, medium: 1, low: 2 }

const PRIORITY_BADGE: Record<Step["priority"], "default" | "secondary" | "outline"> = {
  high:   "default",
  medium: "secondary",
  low:    "outline",
}

const PRIORITY_LABEL: Record<Step["priority"], string> = {
  high:   "Prioridad alta",
  medium: "Prioridad media",
  low:    "Prioridad baja",
}

/**
 * Recommendation list — high-priority items get more visual weight via
 * size + ring intensity, NOT side-stripe borders. Items render in
 * priority order so the user reads the most important ones first; the
 * priority is restated as a badge so it remains scannable when the
 * eye lands mid-list.
 *
 * The previous implementation used `border-l-4 border-l-primary` per
 * priority, which is on the impeccable absolute-bans list (decorative
 * coloured side stripe).
 */
export function RecommendationCards({ steps, title }: Props) {
  if (steps.length === 0) return null

  // Order: high → medium → low (stable within each rank)
  const ordered = [...steps].sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
  )

  return (
    <section className="space-y-(--spacing-block)">
      {title && (
        <h2 className="text-base font-heading font-semibold tracking-tight">
          {title}
        </h2>
      )}
      <ol className="space-y-(--spacing-tight)">
        {ordered.map((s, i) => {
          const isHigh = s.priority === "high"
          return (
            <li key={i}>
              <Card
                size={isHigh ? "default" : "sm"}
                className={cn(
                  "transition-shadow",
                  isHigh && "ring-foreground/15 bg-muted/30",
                )}
              >
                <CardContent className="flex items-start gap-3 py-3">
                  <span
                    aria-hidden
                    className={cn(
                      "font-numeric flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium tabular-nums",
                      isHigh
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p
                        className={cn(
                          "leading-snug",
                          isHigh ? "text-sm font-semibold" : "text-sm font-medium",
                        )}
                      >
                        {s.title}
                      </p>
                      <Badge
                        variant={PRIORITY_BADGE[s.priority]}
                        className="text-[10px] uppercase tracking-wide"
                      >
                        {PRIORITY_LABEL[s.priority]}
                      </Badge>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {s.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
