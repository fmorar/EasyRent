"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircleIcon, ExclamationCircleIcon, MinusCircleIcon } from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils"
import type { ListingQualityCheck } from "@/lib/property-performance/types"

interface Props {
  checks:           ListingQualityCheck[]
  completeness_pct: number
}

const STATUS_ICON: Record<ListingQualityCheck["status"], React.ElementType> = {
  complete: CheckCircleIcon,
  partial:  MinusCircleIcon,
  missing:  ExclamationCircleIcon,
}

const STATUS_COLOR: Record<ListingQualityCheck["status"], string> = {
  complete: "text-success",
  partial:  "text-warning",
  missing:  "text-destructive",
}

const KEY_LABELS: Record<string, string> = {
  has_photos:           "Fotos",
  has_description:      "Descripción",
  has_price:            "Precio",
  has_maintenance_fee:  "Cuota de mantenimiento",
  has_amenities:        "Amenidades",
  has_clear_location:   "Ubicación clara",
  has_bedrooms:         "Habitaciones",
  has_bathrooms:        "Baños",
  has_area:             "Área (m²)",
  has_parking:          "Parqueo",
  is_published:         "Publicada en marketplace",
}

export function ListingQualityChecklist({ checks, completeness_pct }: Props) {
  // Hold the bar at 0 on first paint so the CSS transition can sweep
  // it up on mount. Same pattern as <LeadFunnel>.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <Card>
      <CardContent className="p-5 sm:p-6 space-y-(--spacing-block)">
        {/* Heading + bar form a tight cluster — they describe the same
            metric, so they sit close together above the checklist. */}
        <div className="space-y-(--spacing-cluster)">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-heading font-semibold">Calidad del anuncio</p>
            <p className="text-xl font-numeric font-bold tabular-nums">
              {completeness_pct}%
            </p>
          </div>

          {/* Progress bar — sweeps from 0 to its target on mount. */}
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full",
                completeness_pct >= 80 ? "bg-success"
                : completeness_pct >= 60 ? "bg-warning"
                : "bg-destructive",
              )}
              style={{
                width: mounted ? `${Math.max(2, completeness_pct)}%` : "0%",
                transitionProperty:       "width",
                transitionDuration:       "var(--duration-reveal)",
                transitionTimingFunction: "var(--ease-out-quart)",
              }}
            />
          </div>
        </div>

        {/* Checklist — each row breathes with py-3 and a hairline
            divider so items read as discrete entries rather than
            tight prose. Icon-lockup pattern: status icon · label
            stack · optional recommendation. */}
        <ul>
          {checks.map((c, idx) => {
            const Icon = STATUS_ICON[c.status]
            return (
              <li
                key={c.key}
                className={cn(
                  "flex items-start gap-3 text-sm py-3",
                  idx > 0 && "border-t border-(--hairline-soft)",
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", STATUS_COLOR[c.status])} />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="leading-snug">{KEY_LABELS[c.key] ?? c.key}</p>
                  {c.recommendation && c.status !== "complete" && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {c.recommendation}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
