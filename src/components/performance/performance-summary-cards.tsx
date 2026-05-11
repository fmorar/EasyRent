"use client"

import { useTranslations } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface Props {
  views:           number
  uniqueVisitors:  number
  leads:           number
  qualified:       number
  appointments:    number
  visits:          number
  conversion:      number   // 0..1
  daysOnMarket:    number
}

/**
 * Top-of-page metric block. Two-tier hierarchy instead of 8 identical
 * tiles:
 *
 *   Hero  →  Vistas · Leads · Conversión   (the three numbers the
 *            owner actually scans for)
 *   Strip →  Visitantes · Calificados · Citas · Visitas · Días
 *            (supporting context, packed tight with vertical dividers)
 *
 * This breaks the "hero metric template" anti-pattern (big number + small
 * label, repeated 8 times in an identical grid). Rhythm comes from
 * varying density between the two tiers.
 */
export function PerformanceSummaryCards({
  views, uniqueVisitors, leads, qualified, appointments, visits,
  conversion, daysOnMarket,
}: Props) {
  const t = useTranslations("performanceReports.detail.stat")

  return (
    <Card className="overflow-hidden">
      <CardContent className="px-0 py-0">
        {/* ── Hero tier ──────────────────────────────────────────── */}
        <div className="grid grid-cols-3 divide-x divide-border">
          <Hero label={t("views")}      value={views} />
          <Hero label={t("leads")}      value={leads} emphasis />
          <Hero
            label={t("conversion")}
            value={`${(conversion * 100).toFixed(1)}%`}
          />
        </div>

        {/* ── Secondary strip ────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-border border-t border-border bg-muted/30">
          <Compact label={t("uniqueVisitors")} value={uniqueVisitors} />
          <Compact label={t("qualified")}      value={qualified} />
          <Compact label={t("appointments")}   value={appointments} />
          <Compact label={t("visits")}         value={visits} />
          <Compact label={t("daysOnMarket")}   value={daysOnMarket} />
        </div>
      </CardContent>
    </Card>
  )
}

function Hero({
  label, value, emphasis,
}: { label: string; value: number | string; emphasis?: boolean }) {
  return (
    <div className="px-4 py-5 sm:px-6 sm:py-7 space-y-1.5">
      <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "font-numeric font-bold tabular-nums leading-none",
          emphasis
            ? "text-3xl sm:text-4xl text-foreground"
            : "text-2xl sm:text-[28px] text-foreground/85",
        )}
      >
        {value}
      </p>
    </div>
  )
}

function Compact({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col gap-0.5 min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
        {label}
      </p>
      <p className="font-numeric font-semibold tabular-nums text-base sm:text-lg leading-none">
        {value}
      </p>
    </div>
  )
}
