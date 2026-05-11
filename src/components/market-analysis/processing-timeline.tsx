"use client"

import { useTranslations } from "next-intl"
import { Card } from "@/components/ui/card"
import { useLocale } from "next-intl"
import type { MarketReportEvent } from "@/types"

interface Props {
  events: MarketReportEvent[]
}

// Pipeline-event dot color. Three semantic states:
//   info   — work in progress (network, crawling, scanning)
//   warning— advisory (rate applied, outliers detected)
//   success— terminal positive milestones
//   destructive — failure
//   luxe   — AI / OpenAI moments
//   muted  — neutral milestones
const EVENT_DOT_COLOR: Record<string, string> = {
  report_created:          "bg-muted-foreground",
  source_detected:         "bg-info",
  crawling_started:        "bg-info",
  page_scanned:            "bg-info",
  listings_extracted:      "bg-success",
  normalization_completed: "bg-success",
  exchange_rate_applied:   "bg-warning",
  comparables_filtered:    "bg-luxe",
  outliers_detected:       "bg-warning",
  pricing_calculated:      "bg-success",
  openai_report_generated: "bg-luxe",
  pdf_generated:           "bg-success",
  report_completed:        "bg-success",
  report_failed:           "bg-destructive",
}

export function ProcessingTimeline({ events }: Props) {
  const t      = useTranslations("marketReportDetail")
  const locale = useLocale()
  const dateLocale = locale === "es" ? "es-CR" : "en-US"

  if (events.length === 0) {
    return (
      <Card className="p-(--spacing-block) text-center text-sm text-muted-foreground">
        {t("logEmpty")}
      </Card>
    )
  }

  return (
    <ol className="relative border-l border-border pl-6 space-y-3">
      {events.map((e) => (
        <li key={e.id} className="relative grid grid-cols-[auto_1fr] gap-x-(--spacing-cluster) items-start sm:grid-cols-[8.5rem_1fr]">
          <span
            className={[
              "absolute -left-[29px] top-1.5 inline-block h-2.5 w-2.5 rounded-full ring-2 ring-background",
              EVENT_DOT_COLOR[e.event_type] ?? "bg-muted-foreground",
            ].join(" ")}
            aria-hidden
          />
          {/* Timestamp — fixed-width column on sm+, stacked on mobile */}
          <p className="text-[11px] text-muted-foreground font-numeric tabular-nums whitespace-nowrap col-span-2 sm:col-span-1 sm:pt-0.5">
            {new Date(e.created_at).toLocaleString(dateLocale, {
              day: "2-digit", month: "short",
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
          {/* Event body — type, message */}
          <div className="space-y-0.5 col-span-2 sm:col-span-1 min-w-0">
            <p className="text-xs font-mono text-muted-foreground truncate">{e.event_type}</p>
            {e.message && <p className="text-sm leading-snug">{e.message}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}
