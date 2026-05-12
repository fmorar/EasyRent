import Link from "next/link"
import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { ArrowLeftIcon } from "@heroicons/react/24/outline"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert } from "@/components/ui/alert"
import {
  PerformanceReportStatusBadge,
} from "@/components/performance/performance-status-badge"
import {
  PerformanceHealthScore,
} from "@/components/performance/performance-health-score"
import {
  PerformanceSummaryCards,
} from "@/components/performance/performance-summary-cards"
import { LeadFunnel } from "@/components/performance/lead-funnel"
import {
  ListingQualityChecklist,
} from "@/components/performance/listing-quality-checklist"
import {
  RecommendationCards,
} from "@/components/performance/recommendation-cards"
import {
  OwnerSafeLeadTable,
} from "@/components/performance/owner-safe-lead-table"
import {
  PerformanceReportActions,
} from "@/components/performance/performance-report-actions"
import {
  PublicPropertyPerformanceReport,
  type PublicPerformanceReportData,
} from "@/components/public-report/public-property-performance-report"
import { ReportAutoRefresh } from "@/components/market-analysis/report-auto-refresh"
import type {
  PropertyPerformanceReport, Profile,
} from "@/types"
import type { OwnerReportPayload } from "@/lib/property-performance/types"

interface Params { params: Promise<{ id: string }> }

type ReportRow = PropertyPerformanceReport & {
  creator: Pick<Profile, "id" | "full_name" | "slug" | "avatar_url" | "phone" | "email" | "bio"> | null
}

export default async function PerformanceReportDetailPage({ params }: Params) {
  const { id } = await params
  const { profile } = await requireAuth()
  const supabase = await createClient()
  const t        = await getTranslations("performanceReports.detail")
  const tTabs    = await getTranslations("performanceReports.detail.tabs")

  const { data: rRaw, error } = await supabase
    .from("property_performance_reports")
    .select(`
      *,
      creator:profiles!property_performance_reports_created_by_fkey(
        id, full_name, slug, avatar_url, phone, email, bio
      )
    `)
    .eq("id", id)
    .single()

  if (error || !rRaw) notFound()
  const report = rRaw as ReportRow

  const [{ data: prop }, { data: photoRow }] = await Promise.all([
    supabase.from("properties").select(`
      title, slug, property_type, listing_type,
      bedrooms, bathrooms, parking_spaces, area_sqm,
      display_address, currency, price
    `).eq("id", report.property_id).maybeSingle(),
    supabase
      .from("property_photos")
      .select("url, is_cover, order_index")
      .eq("property_id", report.property_id)
      .order("is_cover", { ascending: false })
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const isProcessing = report.status === "processing" || report.status === "draft"
  const isFailed = report.status === "failed"

  const reportJson = report.report_json as unknown as OwnerReportPayload | null

  // Build the data the public layout expects so the preview tab is identical
  // to what the owner sees.
  const publicData: PublicPerformanceReportData = {
    id:                  report.id,
    created_at:          report.created_at,
    last_generated_at:   report.last_generated_at,
    period_start:        report.report_period_start,
    period_end:          report.report_period_end,
    performance_score:   report.performance_score == null ? null : Number(report.performance_score),
    performance_status:  report.performance_status,
    summary:             report.summary,
    report_json:         reportJson,
    pdf_path:            report.pdf_path,
    visibility:          (report.visibility_settings as PublicPerformanceReportData["visibility"]) ?? {},
    leads:               reportJson?.leads ?? [],
    property: prop ? {
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
    agent: report.creator ? {
      full_name:  report.creator.full_name,
      slug:       report.creator.slug,
      avatar_url: report.creator.avatar_url,
      phone:      report.creator.phone,
      email:      report.creator.email,
      bio:        report.creator.bio,
    } : null,
  }

  return (
    // Vertical rhythm intent: vary space between blocks instead of a
    // uniform value. Sections (header → hero → tabs) get the larger
    // section gap; clusters within each section stay tight.
    <div className="flex flex-col gap-(--spacing-section) py-(--spacing-cluster)">
      {/* Header — title + back link in a tight cluster, separated from
          actions on the right. The status badge sits with the title so
          the eye doesn't have to bounce to find report state. */}
      <header className="flex items-start justify-between gap-(--spacing-cluster)">
        <div className="space-y-1 min-w-0 flex-1">
          <Link href="/performance-reports" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors duration-(--duration-state) ease-(--ease-out-quart)">
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            {t("backToList")}
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-heading font-bold tracking-tight min-w-0 truncate">
              {prop?.title ?? "—"}
            </h1>
            <PerformanceReportStatusBadge status={report.status} />
          </div>
        </div>
        <div className="shrink-0">
          <PerformanceReportActions
            report={{
              id: report.id, status: report.status,
              public_token: report.public_token, pdf_path: report.pdf_path,
            }}
            canManage={report.created_by === profile.id}
          />
        </div>
      </header>

      {/* Status banners */}
      {isProcessing && (
        <>
          <Alert>
            <div className="flex items-start gap-3">
              {/* Two-dot pulse: communicates "actively working" without
                  being a loud spinner. The dots fade in/out 600ms apart
                  so the eye registers movement without visual noise. */}
              <span className="flex h-2 w-2 shrink-0 items-center justify-center mt-1.5">
                <span
                  className="absolute h-2 w-2 rounded-full bg-foreground/30 animate-ping"
                  aria-hidden
                />
                <span className="relative h-1.5 w-1.5 rounded-full bg-foreground/70" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{t("processing")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("processingBody")}</p>
              </div>
            </div>
          </Alert>
          <ReportAutoRefresh />
        </>
      )}
      {isFailed && report.error_message && (
        <Alert variant="destructive">
          <p className="text-sm font-medium">{t("failed")}</p>
          <p className="text-xs mt-1">{report.error_message}</p>
        </Alert>
      )}

      {!reportJson && !isProcessing && !isFailed && (
        <Alert>
          <p className="text-sm">{t("noReportYet")}</p>
        </Alert>
      )}

      {/* Hero score + stats — the score gets its own breathing room
          BEFORE the supporting metrics so the eye lands on the score
          first, reads its explanation, then scans the ribbon. */}
      {reportJson && report.performance_status && report.performance_score != null && (
        <section className="space-y-(--spacing-block)">
          <PerformanceHealthScore
            score={Number(report.performance_score)}
            status={report.performance_status}
            explanation={reportJson.narrative.performance_status_explanation}
          />
          <PerformanceSummaryCards
            views={reportJson.analytics.total_views}
            uniqueVisitors={reportJson.analytics.unique_visitors}
            leads={reportJson.funnel.total_leads}
            qualified={reportJson.funnel.qualified_leads}
            appointments={reportJson.funnel.appointments_scheduled}
            visits={reportJson.funnel.visits_completed}
            conversion={reportJson.funnel.conversion_rate}
            daysOnMarket={reportJson.period.days}
          />
        </section>
      )}

      {/* Tabs */}
      {reportJson && (
        <Tabs defaultValue="overview">
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
            <TabsList className="w-max">
              <TabsTrigger value="overview">{tTabs("overview")}</TabsTrigger>
              <TabsTrigger value="leads">{tTabs("leads")}</TabsTrigger>
              <TabsTrigger value="traffic">{tTabs("traffic")}</TabsTrigger>
              <TabsTrigger value="quality">{tTabs("quality")}</TabsTrigger>
              <TabsTrigger value="preview">{tTabs("preview")}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="pt-(--spacing-block) space-y-(--spacing-block)">
            <Card>
              <CardContent className="p-5 sm:p-6">
                <p className="text-sm whitespace-pre-line leading-relaxed">
                  {reportJson.narrative.executive_summary}
                </p>
              </CardContent>
            </Card>
            <RecommendationCards
              steps={reportJson.narrative.recommended_next_steps}
              title="Próximos pasos recomendados"
            />
          </TabsContent>

          <TabsContent value="leads" className="pt-(--spacing-block) space-y-(--spacing-block)">
            <LeadFunnel
              steps={[
                { label: "Vistas",          value: reportJson.analytics.total_views },
                { label: "Form abierto",    value: reportJson.analytics.form_starts },
                { label: "Leads",           value: reportJson.funnel.total_leads },
                { label: "Contactados",     value: reportJson.funnel.contacted_leads },
                { label: "Calificados",     value: reportJson.funnel.qualified_leads },
                { label: "Citas agendadas", value: reportJson.funnel.appointments_scheduled },
                { label: "Visitas",         value: reportJson.funnel.visits_completed },
                { label: "Ofertas",         value: reportJson.funnel.offers_received },
              ]}
            />
            <OwnerSafeLeadTable leads={reportJson.leads} title="Leads del período" />
          </TabsContent>

          <TabsContent value="traffic" className="pt-(--spacing-block)">
            <Card>
              <CardContent className="p-5 sm:p-6 space-y-(--spacing-cluster)">
                <p className="text-sm font-heading font-semibold">Fuentes de tráfico</p>
                {reportJson.analytics.traffic_sources.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin datos de tráfico todavía.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {reportJson.analytics.traffic_sources.map((s) => (
                      <li key={s.source} className="flex items-baseline justify-between gap-2 text-sm py-1 border-b border-dashed last:border-0">
                        <span className="capitalize">{s.source.replace(/_/g, " ")}</span>
                        <span className="font-numeric tabular-nums text-muted-foreground">
                          {s.views} <span className="text-muted-foreground/60">({s.pct}%)</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quality" className="pt-(--spacing-block)">
            <ListingQualityChecklist
              checks={reportJson.listing_quality.checks}
              completeness_pct={reportJson.listing_quality.completeness_pct}
            />
          </TabsContent>

          <TabsContent value="preview" className="pt-(--spacing-block)">
            <Card className="p-4 sm:p-6 lg:p-8">
              <PublicPropertyPerformanceReport data={publicData} hidePdfButton />
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
