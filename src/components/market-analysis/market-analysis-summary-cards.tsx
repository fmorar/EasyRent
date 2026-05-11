"use client"

import { useTranslations } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"
import { formatPrice } from "@/lib/utils"

interface Props {
  recommended?:    number | null
  rangeMin?:       number | null
  rangeMax?:       number | null
  confidence?:     number | null
  validCount?:     number
  scannedCount?:   number
  excludedCount?:  number
  currency:        string
}

/**
 * Six-stat summary above the report's tabs.
 *
 * Layout breakpoints:
 *   • base   →  2 columns (mobile, ~360-639px)
 *   • sm     →  3 columns (≥640px tablets)
 *   • lg     →  6 columns (≥1024px desktop, single-row strip)
 *
 * Numbers use `font-numeric` and `tabular-nums` so price strings
 * stay aligned across cards. Long prices (e.g. $285,000) get
 * `truncate` to avoid breaking the column width.
 */
export function MarketAnalysisSummaryCards({
  recommended, rangeMin, rangeMax, confidence,
  validCount, scannedCount, excludedCount, currency,
}: Props) {
  const t = useTranslations("marketReportDetail.stat")

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
      <Stat label={t("recommended")}>
        <span className="text-lg sm:text-xl font-numeric font-bold tabular-nums truncate block" title={recommended != null ? formatPrice(recommended, currency) : undefined}>
          {recommended != null ? formatPrice(recommended, currency) : "—"}
        </span>
      </Stat>
      <Stat label={t("range")}>
        {rangeMin != null && rangeMax != null ? (
          // Stack min/max on small cards, inline on wider.
          <span className="text-xs sm:text-sm font-numeric tabular-nums leading-tight">
            <span className="block sm:inline">{formatPrice(rangeMin, currency)}</span>
            <span className="hidden sm:inline"> – </span>
            <span className="block sm:inline text-muted-foreground sm:text-foreground">
              {formatPrice(rangeMax, currency)}
            </span>
          </span>
        ) : (
          <span className="text-sm">—</span>
        )}
      </Stat>
      <Stat label={t("confidence")}>
        <span className="text-lg sm:text-xl font-numeric font-bold tabular-nums">
          {confidence != null ? `${Math.round(confidence)}%` : "—"}
        </span>
      </Stat>
      <Stat label={t("validComparables")}>
        <span className="text-lg sm:text-xl font-numeric font-bold tabular-nums">{validCount ?? 0}</span>
      </Stat>
      <Stat label={t("scanned")}>
        <span className="text-lg sm:text-xl font-numeric font-bold tabular-nums">{scannedCount ?? 0}</span>
      </Stat>
      <Stat label={t("excluded")}>
        <span className="text-lg sm:text-xl font-numeric font-bold tabular-nums">{excludedCount ?? 0}</span>
      </Stat>
    </div>
  )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-3 space-y-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{label}</p>
        {children}
      </CardContent>
    </Card>
  )
}
