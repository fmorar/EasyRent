"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { Alert } from "@/components/ui/alert"
import {
  PropertySelector, type PropertyOption,
} from "./property-selector"
import { SourceUrlInputList } from "./source-url-input-list"
import { SmartFiltersPanel } from "./smart-filters-panel"
import { createMarketReport } from "@/lib/actions/market-report.actions"
import type { MarketFilterConfig } from "@/lib/market-analysis/types"

interface Props {
  properties: PropertyOption[]
}

const DEFAULT_FILTERS: MarketFilterConfig = {
  matchOperationType:     true,
  matchPropertyType:      true,
  prioritizeSameCanton:   true,
  prioritizeSameDistrict: false,
  excludeWithoutPrice:    true,
  excludeOutliers:        true,
  excludeWithoutArea:     false,
}

export function MarketAnalysisForm({ properties }: Props) {
  const router = useRouter()
  const t      = useTranslations("marketAnalysisForm")

  const [propertyId, setPropertyId] = useState<string | null>(null)
  const [selected, setSelected] = useState<PropertyOption | null>(null)
  const [reportType, setReportType] = useState<"sale" | "rent">("sale")
  const [reportLocale, setReportLocale] = useState<"es" | "en">("es")
  const [urls, setUrls] = useState<string[]>([""])
  const [scanDepth, setScanDepth] = useState(3)
  const [maxListings, setMaxListings] = useState(60)
  const [filters, setFilters] = useState<MarketFilterConfig>(DEFAULT_FILTERS)
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onPropertyChange(id: string, prop: PropertyOption) {
    setPropertyId(id)
    setSelected(prop)
    // Pre-select report_type from the property's listing_type
    if (prop.listing_type === "sale" || prop.listing_type === "rent") {
      setReportType(prop.listing_type)
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    if (!propertyId) {
      setServerError(t("errorPropertyRequired"))
      return
    }
    const cleanedUrls = urls.map((u) => u.trim()).filter(Boolean)
    if (cleanedUrls.length === 0) {
      setServerError(t("errorUrlsRequired"))
      return
    }
    for (const u of cleanedUrls) {
      try { new URL(u) } catch {
        setServerError(t("errorInvalidUrl"))
        return
      }
    }

    startTransition(async () => {
      const res = await createMarketReport({
        property_id:   propertyId,
        report_type:   reportType,
        report_locale: reportLocale,
        source_urls:   cleanedUrls,
        scan_depth:    scanDepth,
        max_listings:  maxListings,
        filters,
      })
      if (!res.success) {
        setServerError(res.error || t("submitError"))
        toast.error(res.error || t("submitError"))
        return
      }
      // Fire-and-forget: don't block the user on the 30s+ pipeline.
      // The run handler flips the report's status to 'processing'
      // as its first DB write. We navigate immediately to the detail
      // page, which renders the processing banner + auto-refresh
      // polling until the pipeline completes.
      const reportId = res.data.id
      fetch(`/api/market-reports/${reportId}/run`, { method: "POST" }).catch(() => {
        // Silent — the user can retry from the detail page.
      })
      // Tiny delay so the route handler can flip status before we
      // navigate (avoids flashing the draft state on first render).
      window.setTimeout(() => {
        router.push(`/market-analysis/${reportId}`)
      }, 400)
    })
  }

  return (
    <form onSubmit={submit} className="space-y-6 sm:space-y-8 w-full">
      {serverError && (
        <Alert variant="destructive">
          <p className="text-sm">{serverError}</p>
        </Alert>
      )}

      {/* 1 — Property */}
      <Section title={t("section1Title")} desc={t("section1Desc")}>
        <PropertySelector properties={properties} value={propertyId} onChange={onPropertyChange} />
      </Section>

      {/* 2 — Operation type */}
      <Section title={t("section2Title")} desc={t("section2Desc")}>
        <div className="flex flex-wrap gap-2">
          <ToggleChip
            active={reportType === "sale"}
            onClick={() => setReportType("sale")}
            label={t("operationSale")}
          />
          <ToggleChip
            active={reportType === "rent"}
            onClick={() => setReportType("rent")}
            label={t("operationRent")}
          />
        </div>
      </Section>

      {/* 3 — Sources */}
      <Section title={t("section3Title")} desc={t("section3Desc")}>
        <SourceUrlInputList urls={urls} onChange={setUrls} />
      </Section>

      {/* 4 — Scan settings */}
      <Section title={t("section4Title")} desc={t("section4Desc")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="ma-depth">{t("scanDepthLabel")}</Label>
            <Input
              id="ma-depth"
              type="number"
              min={1}
              max={10}
              value={scanDepth}
              onChange={(e) => setScanDepth(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
            />
            <p className="text-[11px] text-muted-foreground">{t("scanDepthHint")}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ma-max">{t("maxListingsLabel")}</Label>
            <Input
              id="ma-max"
              type="number"
              min={10}
              max={300}
              step={10}
              value={maxListings}
              onChange={(e) => setMaxListings(Math.max(10, Math.min(300, Number(e.target.value) || 60)))}
            />
            <p className="text-[11px] text-muted-foreground">{t("maxListingsHint")}</p>
          </div>
        </div>
      </Section>

      {/* 5 — Filters */}
      <Section title={t("section5Title")} desc={t("section5Desc")}>
        <SmartFiltersPanel value={filters} onChange={setFilters} />
      </Section>

      {/* 6 — Report locale */}
      <Section title={t("section6Title")} desc={t("section6Desc")}>
        <Select value={reportLocale} onValueChange={(v) => v && setReportLocale(v as "es" | "en")}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue>
              {() => reportLocale === "es" ? t("localeEs") : t("localeEn")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="es">{t("localeEs")}</SelectItem>
            <SelectItem value="en">{t("localeEn")}</SelectItem>
          </SelectContent>
        </Select>
      </Section>

      <div className="pt-2">
        <Button type="submit" disabled={pending || !propertyId} size="lg" className="w-full sm:w-auto">
          {pending ? t("submitting") : t("submit")}
        </Button>
      </div>

      {/* prevent unused-var TS warning while we wait for the comparison */}
      <input type="hidden" value={selected ? selected.id : ""} />
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

function ToggleChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-9 px-4 rounded-md border text-sm font-medium transition-colors flex-1 sm:flex-none min-w-[120px]",
        active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted",
      ].join(" ")}
    >
      {label}
    </button>
  )
}
