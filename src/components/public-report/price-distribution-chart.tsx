"use client"

import { useTranslations } from "next-intl"
import { formatPrice } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

export interface PriceChartPoint {
  /** Display label for the bar (e.g. comparable title — short). */
  label?:  string
  /** Numeric value to plot on the y-axis. */
  value:   number
  /** Optional secondary label (e.g. "85 m²"). */
  meta?:   string
}

interface Props {
  points:           PriceChartPoint[]
  recommended:      number
  recommendedMin?:  number
  recommendedMax?:  number
  currency:         string
  className?:       string
}

/**
 * Lightweight pure-SVG bar chart. Renders one bar per comparable's
 * price, sorted ascending, with a horizontal line at the engine's
 * recommended price. Used in the public market report and in the
 * dashboard preview tab.
 *
 * Owner reads it as: "Mira cómo cae mi precio sugerido entre los
 * listados activos del mercado."
 *
 * No chart library — keeps the bundle small and gives us full
 * control over typography and brand colors.
 */
export function PriceDistributionChart({
  points, recommended, recommendedMin, recommendedMax, currency, className,
}: Props) {
  const t = useTranslations("marketReportPublic.chart")

  if (points.length === 0) {
    return null
  }

  const sorted = [...points].sort((a, b) => a.value - b.value)
  const values = sorted.map((p) => p.value)
  const lo = Math.min(...values, recommended)
  const hi = Math.max(...values, recommended)
  const range = Math.max(1, hi - lo)
  // 6% headroom top + bottom so labels and the recommended line
  // don't kiss the edges of the chart.
  const yMin = lo - range * 0.06
  const yMax = hi + range * 0.06
  const ySpan = yMax - yMin

  // SVG viewport — width is responsive (100% width), height is fixed.
  const VIEWBOX_W = 720
  const VIEWBOX_H = 220
  const PADDING_X = 12
  const PADDING_Y = 16
  const innerW = VIEWBOX_W - PADDING_X * 2
  const innerH = VIEWBOX_H - PADDING_Y * 2

  const barCount = sorted.length
  const barGap   = barCount <= 12 ? 6 : 3
  const barW     = (innerW - barGap * (barCount - 1)) / barCount

  const yToPx = (v: number) => PADDING_Y + innerH - ((v - yMin) / ySpan) * innerH
  const recommendedY    = yToPx(recommended)
  const recommendedMinY = recommendedMin != null ? yToPx(recommendedMin) : null
  const recommendedMaxY = recommendedMax != null ? yToPx(recommendedMax) : null

  // Stats summary above the chart
  const median = computeMedian(values)
  const min    = values[0]
  const max    = values[values.length - 1]

  return (
    <Card className={className}>
      <CardContent className="p-5 space-y-4">
        <header className="flex items-baseline justify-between gap-3 flex-wrap">
          <p className="text-sm font-heading font-semibold">{t("title")}</p>
          <p className="text-xs text-muted-foreground">
            {barCount === 1
              ? t("nComparablesOne")
              : t("nComparablesMany", { count: barCount })}
          </p>
        </header>

        {/* Mini stats row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label={t("min")}    value={formatPrice(min,    currency)} />
          <Stat label={t("median")} value={formatPrice(median, currency)} />
          <Stat label={t("max")}    value={formatPrice(max,    currency)} />
        </div>

        {/* SVG */}
        <div className="w-full">
          <svg
            viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
            className="w-full h-auto"
            role="img"
            aria-label={t("ariaLabel")}
          >
            {/* Recommended price band (min..max) */}
            {recommendedMinY != null && recommendedMaxY != null && (
              <rect
                x={PADDING_X}
                y={Math.min(recommendedMinY, recommendedMaxY)}
                width={innerW}
                height={Math.abs(recommendedMaxY - recommendedMinY)}
                fill="currentColor"
                className="text-primary"
                opacity="0.08"
              />
            )}

            {/* Bars */}
            {sorted.map((p, i) => {
              const x = PADDING_X + i * (barW + barGap)
              const y = yToPx(p.value)
              const h = PADDING_Y + innerH - y
              const isInside = recommendedMin != null && recommendedMax != null
                && p.value >= recommendedMin && p.value <= recommendedMax
              // Build the tooltip text as a single template literal —
              // JSX whitespace between expressions on different lines
              // can serialise differently in SSR vs CSR inside an SVG
              // `<title>` element, which triggers React hydration
              // warnings. One string = byte-identical output.
              const tooltip =
                `${p.label ?? ""}${p.label ? " — " : ""}` +
                `${formatPrice(p.value, currency)}` +
                `${p.meta ? ` · ${p.meta}` : ""}`
              return (
                <rect
                  key={i}
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx={2}
                  className={isInside ? "fill-primary/70" : "fill-muted-foreground/40"}
                >
                  <title>{tooltip}</title>
                </rect>
              )
            })}

            {/* Recommended price line */}
            <line
              x1={PADDING_X} x2={PADDING_X + innerW}
              y1={recommendedY} y2={recommendedY}
              className="stroke-primary"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            <text
              x={PADDING_X + innerW - 4}
              y={recommendedY - 6}
              textAnchor="end"
              className="fill-primary text-[11px] font-medium"
              style={{ fontFamily: "var(--font-numeric, monospace)" }}
            >
              {t("recommendedLabel")}: {formatPrice(recommended, currency)}
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
          <LegendDot className="bg-primary/70" label={t("legendInRange")} />
          <LegendDot className="bg-muted-foreground/40" label={t("legendOther")} />
          <LegendDash label={t("legendRecommended")} />
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-numeric font-semibold mt-0.5">{value}</p>
    </div>
  )
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={["inline-block h-2.5 w-2.5 rounded-sm", className].join(" ")} />
      {label}
    </span>
  )
}

function LegendDash({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-0.5 w-4 bg-primary" />
      {label}
    </span>
  )
}

function computeMedian(sortedAsc: number[]): number {
  if (sortedAsc.length === 0) return 0
  const m = Math.floor(sortedAsc.length / 2)
  return sortedAsc.length % 2
    ? sortedAsc[m]
    : (sortedAsc[m - 1] + sortedAsc[m]) / 2
}
