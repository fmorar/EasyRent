"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Alert } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  PropertySelector, type PropertyOption,
} from "@/components/market-analysis/property-selector"
import { LeadChipSelect } from "@/components/property/lead-chip-select"
import { createPerformanceReport } from "@/lib/actions/performance-report.actions"

interface Props {
  properties: PropertyOption[]
}

type Period = "since_published" | "last_7" | "last_14" | "last_30"

export function NewPerformanceReportForm({ properties }: Props) {
  const router = useRouter()
  const t      = useTranslations("performanceReports.form")

  const [propertyId, setPropertyId] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>("since_published")
  const [showLeadList, setShowLeadList] = useState(true)
  const [leadInitialsOnly, setLeadInitialsOnly] = useState(true)
  const [showTraffic, setShowTraffic] = useState(true)
  const [showTimeline, setShowTimeline] = useState(true)
  const [showRecommendations, setShowRecommendations] = useState(true)
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function periodToRange(p: Period): { start: string | null; end: string | null } {
    if (p === "since_published") return { start: null, end: null }
    const now = new Date()
    const days = p === "last_7" ? 7 : p === "last_14" ? 14 : 30
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    return { start: start.toISOString(), end: now.toISOString() }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    if (!propertyId) {
      setServerError(t("submitError"))
      return
    }
    startTransition(async () => {
      const range = periodToRange(period)
      const res = await createPerformanceReport({
        property_id:         propertyId,
        report_period_start: range.start,
        report_period_end:   range.end,
        visibility_settings: {
          show_lead_list:       showLeadList,
          lead_initials_only:   leadInitialsOnly,
          show_traffic:         showTraffic,
          show_timeline:        showTimeline,
          show_recommendations: showRecommendations,
        },
      })
      if (!res.success) {
        setServerError(res.error || t("submitError"))
        toast.error(res.error || t("submitError"))
        return
      }
      // Fire-and-forget pipeline
      const reportId = res.data.id
      fetch(`/api/performance-reports/${reportId}/run`, { method: "POST" })
        .catch(() => { /* user can retry */ })
      window.setTimeout(() => router.push(`/performance-reports/${reportId}`), 400)
    })
  }

  const periodOptions = [
    { value: "since_published" as const, label: t("periodSincePublished") },
    { value: "last_7"          as const, label: t("periodLast7") },
    { value: "last_14"         as const, label: t("periodLast14") },
    { value: "last_30"         as const, label: t("periodLast30") },
  ]

  return (
    <form onSubmit={submit} className="space-y-6 sm:space-y-8 w-full">
      {serverError && (
        <Alert variant="destructive">
          <p className="text-sm">{serverError}</p>
        </Alert>
      )}

      {/* 1 — Property */}
      <Section title={t("section1Title")} desc={t("section1Desc")}>
        <PropertySelector
          properties={properties}
          value={propertyId}
          onChange={(id) => setPropertyId(id)}
        />
      </Section>

      {/* 2 — Period */}
      <Section title={t("section2Title")} desc={t("section2Desc")}>
        <LeadChipSelect<Period>
          options={periodOptions}
          value={period}
          onChange={(v) => v && setPeriod(v)}
          clearable={false}
        />
      </Section>

      {/* 3 — Visibility */}
      <Section title={t("section3Title")} desc={t("section3Desc")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <ToggleRow checked={showLeadList} onChange={setShowLeadList} label={t("showLeadList")} />
          <ToggleRow checked={leadInitialsOnly} onChange={setLeadInitialsOnly} label={t("leadInitialsOnly")} />
          <ToggleRow checked={showTraffic} onChange={setShowTraffic} label={t("showTraffic")} />
          <ToggleRow checked={showTimeline} onChange={setShowTimeline} label={t("showTimeline")} />
          <ToggleRow checked={showRecommendations} onChange={setShowRecommendations} label={t("showRecommendations")} />
        </div>
      </Section>

      <div className="pt-2">
        <Button type="submit" disabled={pending || !propertyId} size="lg" className="w-full sm:w-auto">
          {pending ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  )
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <Card className="p-4 sm:p-5 lg:p-6 space-y-4">
      <header className="space-y-1">
        <h2 className="text-base sm:text-[15px] font-heading font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
      </header>
      {children}
    </Card>
  )
}

function ToggleRow({
  checked, onChange, label,
}: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Label className="flex items-center gap-3 rounded-md border bg-card px-3 py-2.5 cursor-pointer hover:bg-muted/40">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(Boolean(v))}
      />
      <span className="text-sm font-normal">{label}</span>
    </Label>
  )
}
