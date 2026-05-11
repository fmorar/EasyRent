"use client"

import { useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"
import type { PerfReportStatus, PerfHealthStatus } from "@/types"

const STATUS_VARIANT: Record<PerfReportStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft:      "outline",
  processing: "secondary",
  active:     "default",
  archived:   "outline",
  failed:     "destructive",
}

export function PerformanceReportStatusBadge({ status }: { status: PerfReportStatus }) {
  const t = useTranslations("performanceReports.status")
  return (
    <Badge variant={STATUS_VARIANT[status]} className="text-xs">
      {t(status)}
    </Badge>
  )
}

const HEALTH_VARIANT: Record<PerfHealthStatus, "default" | "secondary" | "outline" | "destructive"> = {
  strong:          "default",
  healthy:         "secondary",
  needs_attention: "outline",
  low_activity:    "destructive",
}

export function PerformanceHealthBadge({ status }: { status: PerfHealthStatus }) {
  const t = useTranslations("performanceReports.health")
  return (
    <Badge variant={HEALTH_VARIANT[status]} className="text-xs">
      {t(status)}
    </Badge>
  )
}
