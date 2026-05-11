"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline"
import type { HealthWarning, WarningSeverity } from "@/types/contracts"

interface Props {
  warnings: HealthWarning[]
}

const SEVERITY_ICON: Record<WarningSeverity, React.ElementType> = {
  high:   ShieldExclamationIcon,
  medium: ExclamationTriangleIcon,
  low:    InformationCircleIcon,
}

const SEVERITY_COLOR: Record<WarningSeverity, string> = {
  high:   "text-destructive",
  medium: "text-warning",
  low:    "text-muted-foreground",
}

const SEVERITY_LABEL: Record<WarningSeverity, string> = {
  high:   "Crítica",
  medium: "Importante",
  low:    "Sugerencia",
}

/** Stack of warnings surfaced by the template-health-check service. */
export function TemplateHealthWarnings({ warnings }: Props) {
  if (warnings.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-success shrink-0" aria-hidden />
          <p className="text-sm">Sin alertas en el contrato.</p>
        </CardContent>
      </Card>
    )
  }

  // Order: high → medium → low
  const order: WarningSeverity[] = ["high", "medium", "low"]
  const sorted = [...warnings].sort(
    (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity),
  )

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldExclamationIcon className="h-4 w-4 text-destructive" />
          <p className="text-sm font-medium">Alertas del contrato</p>
          <Badge variant="secondary" className="ml-auto font-numeric tabular-nums">
            {warnings.length}
          </Badge>
        </div>
        <ul className="space-y-2">
          {sorted.map((w, i) => {
            const Icon = SEVERITY_ICON[w.severity]
            return (
              <li
                key={`${w.code}-${i}`}
                className="rounded-md border bg-card p-3 space-y-1.5"
              >
                <div className="flex items-start gap-2">
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${SEVERITY_COLOR[w.severity]}`} />
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <p className="text-sm font-medium leading-tight">{w.title}</p>
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase tracking-wide"
                      >
                        {SEVERITY_LABEL[w.severity]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {w.description}
                    </p>
                    {w.suggested_action && (
                      <p className="text-xs leading-relaxed text-foreground/70 pt-1">
                        <strong className="font-medium">Sugerencia:</strong>{" "}
                        {w.suggested_action}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
