"use client"

import { useTranslations } from "next-intl"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { MarketFilterConfig } from "@/lib/market-analysis/types"

interface Props {
  value:    MarketFilterConfig
  onChange: (next: MarketFilterConfig) => void
}

export function SmartFiltersPanel({ value, onChange }: Props) {
  const t = useTranslations("marketAnalysisForm.filter")
  const set = <K extends keyof MarketFilterConfig>(k: K, v: MarketFilterConfig[K]) =>
    onChange({ ...value, [k]: v })

  const rows: Array<{ k: keyof MarketFilterConfig; label: string }> = [
    { k: "matchOperationType",     label: t("matchOperation") },
    { k: "matchPropertyType",      label: t("matchPropertyType") },
    { k: "prioritizeSameCanton",   label: t("prioritizeCanton") },
    { k: "prioritizeSameDistrict", label: t("prioritizeDistrict") },
    { k: "excludeWithoutPrice",    label: t("excludeNoPrice") },
    { k: "excludeOutliers",        label: t("excludeOutliers") },
    { k: "excludeWithoutArea",     label: t("excludeNoArea") },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {rows.map(({ k, label }) => (
        <Label
          key={k as string}
          className="flex items-center gap-3 rounded-md border bg-card px-3 py-2.5 cursor-pointer hover:bg-muted/40"
        >
          <Checkbox
            checked={Boolean(value[k])}
            onCheckedChange={(v) => set(k, Boolean(v) as MarketFilterConfig[typeof k])}
          />
          <span className="text-sm font-normal">{label}</span>
        </Label>
      ))}
    </div>
  )
}
