import Link from "next/link"
import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { ArrowLeftIcon } from "@heroicons/react/24/outline"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { MarketAnalysisStatusBadge } from "@/components/market-analysis/market-analysis-status-badge"
import { MarketAnalysisSummaryCards } from "@/components/market-analysis/market-analysis-summary-cards"
import { ComparableListingsTable } from "@/components/market-analysis/comparable-listings-table"
import { ProcessingTimeline } from "@/components/market-analysis/processing-timeline"
import { ReportActions } from "@/components/market-analysis/report-actions"
import { PublicMarketReport, type PublicReportData } from "@/components/public-report/public-market-report"
import { ReportAutoRefresh } from "@/components/market-analysis/report-auto-refresh"
import type {
  MarketReport, MarketReportComparable, MarketReportSource, MarketReportEvent, Profile,
} from "@/types"
import type { OpenAIMarketReport } from "@/lib/market-analysis/types"

interface Params { params: Promise<{ id: string }> }

type ReportRow = MarketReport & {
  creator: Pick<Profile, "id" | "full_name" | "slug" | "avatar_url" | "phone" | "email" | "bio"> | null
}

export default async function MarketReportDetailPage({ params }: Params) {
  const { id } = await params
  await requireAuth()
  const supabase = await createClient()
  const t        = await getTranslations("marketReportDetail")
  const tTabs    = await getTranslations("marketReportDetail.tabs")
  const tSrc     = await getTranslations("marketReportDetail.sourceTable")

  const { data: rRaw, error } = await supabase
    .from("market_reports")
    .select(`
      *,
      creator:profiles!market_reports_created_by_fkey(
        id, full_name, slug, avatar_url, phone, email, bio
      )
    `)
    .eq("id", id)
    .single()

  if (error || !rRaw) notFound()
  const report = rRaw as ReportRow

  const [{ data: comparables }, { data: sources }, { data: events }, { data: prop }, { data: photoRow }] = await Promise.all([
    supabase.from("market_report_comparables").select("*").eq("report_id", id).order("similarity_score", { ascending: false, nullsFirst: false }),
    supabase.from("market_report_sources").select("*").eq("report_id", id).order("created_at"),
    supabase.from("market_report_events").select("*").eq("report_id", id).order("created_at", { ascending: false }),
    supabase.from("properties").select(`
      title, slug, property_type, listing_type,
      bedrooms, bathrooms, parking_spaces, area_sqm,
      display_address, currency, price
    `).eq("id", report.property_id).maybeSingle(),
    // Cover photo for the preview tab — same logic the public RPC uses
    // (is_cover first, then lowest order_index).
    supabase
      .from("property_photos")
      .select("url, is_cover, order_index")
      .eq("property_id", report.property_id)
      .order("is_cover", { ascending: false })
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const allComparables    = (comparables ?? []) as MarketReportComparable[]
  const validComparables  = allComparables.filter((c) => !c.exclusion_reason && !c.is_outlier)
  const excludedComparables = allComparables.filter((c) => c.exclusion_reason || c.is_outlier)
  const sourceRows = (sources ?? []) as MarketReportSource[]
  const eventRows  = (events ?? []) as MarketReportEvent[]

  const isProcessing = report.status === "processing" || report.status === "draft"

  // Top 10 by similarity for the preview's comparables list (mirrors
  // what the public RPC exposes to the owner).
  const previewComparables = validComparables.slice(0, 10).map((c) => ({
    title:            c.title,
    source_name:      c.source_name,
    listing_url:      c.listing_url,
    location_text:    c.location_text,
    canton:           c.canton,
    district:         c.district,
    price:            c.price == null ? null : Number(c.price),
    currency:         c.currency,
    bedrooms:         c.bedrooms == null ? null : Number(c.bedrooms),
    bathrooms:        c.bathrooms == null ? null : Number(c.bathrooms),
    built_area_m2:    c.built_area_m2 == null ? null : Number(c.built_area_m2),
    price_per_m2:     c.price_per_m2 == null ? null : Number(c.price_per_m2),
    similarity_score: c.similarity_score == null ? null : Number(c.similarity_score),
  }))

  // Build the public-shape data for the preview tab
  const publicData: PublicReportData = {
    id:                    report.id,
    created_at:            report.created_at,
    report_type:           report.report_type,
    report_locale:         report.report_locale === "en" ? "en" : "es",
    currency:              report.currency,
    recommended_price:     report.recommended_price == null ? null : Number(report.recommended_price),
    recommended_price_min: report.recommended_price_min == null ? null : Number(report.recommended_price_min),
    recommended_price_max: report.recommended_price_max == null ? null : Number(report.recommended_price_max),
    confidence_score:      report.confidence_score == null ? null : Number(report.confidence_score),
    report_json:           (report.report_json as unknown as OpenAIMarketReport | null) ?? null,
    pdf_path:              report.pdf_path,
    comparables:           previewComparables,
    agent: report.creator ? {
      full_name:  report.creator.full_name,
      slug:       report.creator.slug,
      avatar_url: report.creator.avatar_url,
      phone:      report.creator.phone,
      email:      report.creator.email,
      bio:        report.creator.bio,
    } : null,
    property:              prop ? {
      title:           prop.title,
      slug:            prop.slug,
      cover_url:       photoRow?.url ?? null,
      property_type:   prop.property_type,
      listing_type:    prop.listing_type,
      bedrooms:        prop.bedrooms,
      bathrooms:       prop.bathrooms,
      parking_spaces:  prop.parking_spaces,
      area_sqm:        prop.area_sqm == null ? null : Number(prop.area_sqm),
      display_address: prop.display_address,
      currency:        prop.currency,
      price:           prop.price == null ? null : Number(prop.price),
    } : null,
  }

  return (
    <div className="space-y-(--spacing-block) sm:space-y-(--spacing-section)">
      {/* Header — title can be long; truncate but keep status badge visible */}
      <header className="flex items-start justify-between gap-(--spacing-tight) sm:gap-(--spacing-cluster)">
        <div className="space-y-1 min-w-0 flex-1">
          <Link
            href="/market-analysis"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors duration-(--duration-state) ease-(--ease-out-quart)"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            {t("backToList")}
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-heading font-bold tracking-tight min-w-0 truncate">
              {report.title ?? "—"}
            </h1>
            <MarketAnalysisStatusBadge status={report.status} />
          </div>
        </div>
        <div className="shrink-0">
          <ReportActions
            report={{ id: report.id, status: report.status, public_token: report.public_token, pdf_path: report.pdf_path }}
          />
        </div>
      </header>

      {/* Status banners */}
      {isProcessing && (
        <>
          <Alert>
            <p className="text-sm font-medium">{t("processing")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("processingBody")}</p>
          </Alert>
          <ReportAutoRefresh />
        </>
      )}
      {report.status === "failed" && report.error_message && (
        <Alert variant="destructive">
          <p className="text-sm font-medium">{t("failed")}</p>
          <p className="text-xs mt-1">{report.error_message}</p>
        </Alert>
      )}

      {/* Stats */}
      <MarketAnalysisSummaryCards
        recommended={report.recommended_price == null ? null : Number(report.recommended_price)}
        rangeMin={report.recommended_price_min == null ? null : Number(report.recommended_price_min)}
        rangeMax={report.recommended_price_max == null ? null : Number(report.recommended_price_max)}
        confidence={report.confidence_score == null ? null : Number(report.confidence_score)}
        validCount={validComparables.length}
        scannedCount={allComparables.length}
        excludedCount={excludedComparables.length}
        currency={report.currency}
      />

      {/* Tabs — 6 of them, so on mobile we scroll horizontally
          instead of clipping. The bleed (-mx-4 px-4) lets the
          scroll edge hit the viewport on small screens.           */}
      <Tabs defaultValue="overview">
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-thin">
          <TabsList className="w-max">
            <TabsTrigger value="overview">{tTabs("overview")}</TabsTrigger>
            <TabsTrigger value="comparables">{tTabs("comparables")}</TabsTrigger>
            <TabsTrigger value="methodology">{tTabs("methodology")}</TabsTrigger>
            <TabsTrigger value="sources">{tTabs("sources")}</TabsTrigger>
            <TabsTrigger value="log">{tTabs("log")}</TabsTrigger>
            <TabsTrigger value="preview">{tTabs("preview")}</TabsTrigger>
          </TabsList>
        </div>

        {/* Overview */}
        <TabsContent value="overview" className="pt-(--spacing-block)">
          <Card>
            <CardContent className="p-6">
              {report.summary ? (
                <p className="text-sm whitespace-pre-line leading-relaxed">{report.summary}</p>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comparables */}
        <TabsContent value="comparables" className="pt-(--spacing-cluster) space-y-(--spacing-block)">
          <Card>
            <ComparableListingsTable comparables={validComparables} />
          </Card>
          {excludedComparables.length > 0 && (
            <section className="space-y-(--spacing-tight)">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("excludedSummary")} ({excludedComparables.length})
              </h2>
              <Card>
                <ComparableListingsTable comparables={excludedComparables} excludedView />
              </Card>
            </section>
          )}
        </TabsContent>

        {/* Methodology — metrics row stays tight to the heading, the
            narrative gets its own breathing room beneath. */}
        <TabsContent value="methodology" className="pt-(--spacing-block)">
          <Card>
            <CardContent className="p-6 space-y-(--spacing-block)">
              <div className="space-y-(--spacing-cluster)">
                <h2 className="text-base font-heading font-semibold">{t("methodologyTitle")}</h2>
                <MethodologyMetrics metadata={report.metadata as Record<string, unknown>} currency={report.currency} />
              </div>
              <p className="text-sm whitespace-pre-line leading-relaxed">
                {(publicData.report_json?.methodology) ?? "—"}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sources — narrow viewports get horizontal scroll inside the
            card, URL column truncates with progressively smaller caps. */}
        <TabsContent value="sources" className="pt-(--spacing-block)">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="px-3 sm:px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{tSrc("url")}</th>
                    <th className="px-3 sm:px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{tSrc("source")}</th>
                    <th className="px-3 sm:px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground hidden sm:table-cell">{tSrc("type")}</th>
                    <th className="px-3 sm:px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground text-right hidden md:table-cell">{tSrc("pages")}</th>
                    <th className="px-3 sm:px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">{tSrc("listings")}</th>
                    <th className="px-3 sm:px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{tSrc("status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceRows.map((s) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="px-3 sm:px-4 py-2 max-w-[180px] sm:max-w-[280px] lg:max-w-[420px] truncate">
                        <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline">
                          {s.source_url}
                        </a>
                      </td>
                      <td className="px-3 sm:px-4 py-2 text-xs">{s.source_name ?? "—"}</td>
                      <td className="px-3 sm:px-4 py-2 text-xs hidden sm:table-cell">{s.source_type ?? "—"}</td>
                      <td className="px-3 sm:px-4 py-2 text-xs text-right font-numeric hidden md:table-cell">{s.pages_scanned}</td>
                      <td className="px-3 sm:px-4 py-2 text-xs text-right font-numeric">{s.listings_found}</td>
                      <td className="px-3 sm:px-4 py-2"><Badge variant="outline" className="text-[10px]">{s.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Log */}
        <TabsContent value="log" className="pt-(--spacing-block)">
          <ProcessingTimeline events={eventRows} />
        </TabsContent>

        {/* Public preview — render exactly what the owner sees. The
            inner card padding is smaller on phones so the report's own
            spacing carries the rhythm. */}
        <TabsContent value="preview" className="pt-(--spacing-block)">
          <Card className="p-4 sm:p-6 lg:p-8">
            <PublicMarketReport
              data={publicData}
              preparedByName={report.creator?.full_name ?? null}
              hidePdfButton
            />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── Methodology metrics from `metadata.engine` ─────────────
function MethodologyMetrics({ metadata, currency }: { metadata: Record<string, unknown> | null; currency: string }) {
  const engine = (metadata?.engine ?? {}) as Record<string, unknown>
  const fields: Array<[string, string]> = [
    ["Weighted price/m²",   engine.weighted_ppm2 != null ? `${Math.round(Number(engine.weighted_ppm2))} ${currency}` : "—"],
    ["Median price/m²",     engine.median_ppm2 != null ? `${Math.round(Number(engine.median_ppm2))} ${currency}` : "—"],
    ["Outliers detected",   String(engine.outliers_detected ?? "—")],
    ["FX USD→CRC used",     engine.fx_rate != null ? `${Number(engine.fx_rate).toFixed(2)} (${String(engine.fx_source ?? "?")})` : "—"],
  ]
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {fields.map(([k, v]) => (
        <div key={k} className="rounded-md border p-3">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</dt>
          <dd className="text-sm font-numeric mt-0.5">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
