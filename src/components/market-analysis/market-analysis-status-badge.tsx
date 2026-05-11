"use client"

import { useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"
import type { MarketReportStatus } from "@/types"

const VARIANT: Record<MarketReportStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft:      "outline",
  processing: "secondary",
  completed:  "default",
  failed:     "destructive",
}

export function MarketAnalysisStatusBadge({ status }: { status: MarketReportStatus }) {
  const t = useTranslations("marketAnalysis.status")
  return (
    <Badge variant={VARIANT[status]} className="text-xs">
      {t(status)}
    </Badge>
  )
}
