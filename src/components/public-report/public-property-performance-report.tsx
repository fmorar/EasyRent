"use client"

import { useTranslations } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LegalDisclaimer } from "@/components/shared/legal-disclaimer"
import {
  AgentSignatureBlock, type AgentSignatureProps,
} from "@/components/public-report/agent-signature-block"
import { PerformanceHealthScore } from "@/components/performance/performance-health-score"
import { PerformanceSummaryCards } from "@/components/performance/performance-summary-cards"
import { LeadFunnel } from "@/components/performance/lead-funnel"
import { ListingQualityChecklist } from "@/components/performance/listing-quality-checklist"
import { RecommendationCards } from "@/components/performance/recommendation-cards"
import {
  OwnerSafeLeadTable, type OwnerSafeLeadRow,
} from "@/components/performance/owner-safe-lead-table"
import type { OwnerReportPayload } from "@/lib/property-performance/types"

export interface PublicPerformanceReportData {
  id:                 string
  created_at:         string
  last_generated_at:  string | null
  period_start:       string | null
  period_end:         string | null
  performance_score:  number | null
  performance_status: OwnerReportPayload["performance_status"] | null
  summary:            string | null
  report_json:        OwnerReportPayload | null
  pdf_path:           string | null
  visibility:         {
    show_lead_list?:       boolean
    show_traffic?:         boolean
    show_timeline?:        boolean
    show_recommendations?: boolean
    lead_initials_only?:   boolean
  }
  leads:              OwnerSafeLeadRow[]
  property: {
    title:           string
    slug:            string
    cover_url?:      string | null
    property_type:   string
    listing_type:    "sale" | "rent"
    bedrooms:        number | null
    bathrooms:       number | null
    parking_spaces:  number | null
    area_sqm:        number | null
    display_address: string | null
    currency:        string
    price:           number | null
  } | null
  agent?: AgentSignatureProps["agent"] | null
}

interface Props {
  data:           PublicPerformanceReportData
  /** Hides the "Download PDF" button when used in the dashboard preview. */
  hidePdfButton?: boolean
}

/**
 * Public owner-facing report.
 *
 * Layout philosophy (post-impeccable redesign):
 * - **Variable widths per block** instead of one max-w-3xl column.
 *   Cover is wide-but-bounded, body narrative is narrow for reading,
 *   metrics ribbon is medium so numbers breathe.
 * - **No card-everything**: narrative sections, traffic-source list,
 *   and disclaimer are bare prose, not card-wrapped.
 * - **Editorial rhythm**: tight cluster spacing within a section,
 *   generous separation between sections via a single
 *   `space-y-(--spacing-section)` on the article root.
 */
export function PublicPropertyPerformanceReport({ data, hidePdfButton }: Props) {
  const t       = useTranslations("performanceReports.public")
  const r       = data.report_json
  const property = data.property
  const showLeads = data.visibility.show_lead_list !== false
  const showTraffic = data.visibility.show_traffic !== false
  const showRecs  = data.visibility.show_recommendations !== false

  return (
    <article>
      {/* ── Cover photo (wide, bleeds further than body) ─────────── */}
      {property?.cover_url && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-(--spacing-cluster) sm:pt-(--spacing-section)">
          <div className="relative w-full aspect-[16/9] sm:aspect-[2.4/1] overflow-hidden rounded-2xl bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={property.cover_url}
              alt={property.title}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
      )}

      {/* ── Body column (narrow for readability) ─────────────────── */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 mt-(--spacing-section) space-y-(--spacing-section)">
        {/* Header */}
        <header className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {t("coverEyebrow")}
          </p>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold leading-[1.1] tracking-tight">
            {property?.title ?? t("metaTitle")}
          </h1>
          {property?.display_address && (
            <p className="text-sm text-muted-foreground">{property.display_address}</p>
          )}
          {data.agent?.full_name && (
            <p className="text-xs text-muted-foreground pt-1">
              {t("preparedBy")}{" "}
              <span className="font-medium text-foreground">{data.agent.full_name}</span>
              {" · "}
              {t("preparedOn")}{" "}
              {new Date(data.last_generated_at ?? data.created_at).toLocaleDateString()}
            </p>
          )}
        </header>

        {/* Property chips + PDF download row */}
        {(property || (!hidePdfButton && data.pdf_path)) && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {property && (
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{property.property_type}</Badge>
                <Badge variant="secondary">{property.listing_type}</Badge>
                {property.bedrooms != null && (
                  <Badge variant="outline">{property.bedrooms} hab.</Badge>
                )}
                {property.bathrooms != null && (
                  <Badge variant="outline">{property.bathrooms} bn.</Badge>
                )}
                {property.area_sqm != null && (
                  <Badge variant="outline">{property.area_sqm} m²</Badge>
                )}
              </div>
            )}
            {!hidePdfButton && data.pdf_path && (
              <a
                href={`/api/performance-reports/${data.id}/pdf?token=public`}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-foreground text-background text-sm font-medium hover:bg-foreground/90"
              >
                {t("downloadPdf")}
              </a>
            )}
          </div>
        )}
      </div>

      {/* ── Score (medium width, anchored as its own hero moment) ──
          Uses --spacing-major so the hero score reads as a separate
          band from the title cluster above — not tucked under it. */}
      {r && data.performance_score != null && data.performance_status && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-(--spacing-major)">
          <PerformanceHealthScore
            score={data.performance_score}
            status={data.performance_status}
            explanation={r.narrative.performance_status_explanation}
          />
        </div>
      )}

      {/* ── Executive summary (narrow, prose) ────────────────────── */}
      {r?.narrative.executive_summary && (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 mt-(--spacing-major) space-y-(--spacing-block)">
          <SectionHeading>{t("executiveSummary")}</SectionHeading>
          <p className="text-base text-foreground/90 leading-relaxed whitespace-pre-line">
            {r.narrative.executive_summary}
          </p>
        </div>
      )}

      {/* ── Metrics ribbon (wide so the numbers breathe) ─────────── */}
      {r && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-(--spacing-major) space-y-(--spacing-block)">
          <SectionHeading>{t("metricsTitle")}</SectionHeading>
          <div className="py-(--spacing-tight)">
            <PerformanceSummaryCards
              views={r.analytics.total_views}
              uniqueVisitors={r.analytics.unique_visitors}
              leads={r.funnel.total_leads}
              qualified={r.funnel.qualified_leads}
              appointments={r.funnel.appointments_scheduled}
              visits={r.funnel.visits_completed}
              conversion={r.funnel.conversion_rate}
              daysOnMarket={r.period.days}
            />
          </div>
        </div>
      )}

      {/* ── Funnel (medium, plain — no Card wrapper around it).
          The funnel is a chart; wrap it in its own padded container so
          the bars don't crowd the section heading or the next block. */}
      {r && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-(--spacing-major) space-y-(--spacing-block)">
          <SectionHeading>{t("funnelTitle")}</SectionHeading>
          <div className="py-(--spacing-block)">
            <LeadFunnel
              steps={[
                { label: "Vistas",          value: r.analytics.total_views },
                { label: "Form abierto",    value: r.analytics.form_starts },
                { label: "Leads",           value: r.funnel.total_leads },
                { label: "Contactados",     value: r.funnel.contacted_leads },
                { label: "Calificados",     value: r.funnel.qualified_leads },
                { label: "Citas agendadas", value: r.funnel.appointments_scheduled },
                { label: "Visitas",         value: r.funnel.visits_completed },
                { label: "Ofertas",         value: r.funnel.offers_received },
              ]}
            />
          </div>
        </div>
      )}

      {/* ── Narrative blocks (narrow, prose, no cards) ───────────── */}
      {r && (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 mt-(--spacing-major) space-y-(--spacing-block)">
          <NarrativeSection title="Tráfico y vistas"     body={r.narrative.traffic_summary} />
          <NarrativeSection title="Calidad de los leads" body={r.narrative.lead_quality_summary} />
          <NarrativeSection title="Citas y visitas"      body={r.narrative.appointment_summary} />
          <NarrativeSection title={t("questionsTitle")}  body={r.narrative.main_questions_summary} />
          <NarrativeSection title={t("objectionsTitle")} body={r.narrative.main_objections_summary} />
          <NarrativeSection title="Estrategia de precio" body={r.narrative.price_strategy_summary} />
        </div>
      )}

      {/* ── Traffic sources (bare list, no card chrome) ──────────── */}
      {showTraffic && r && r.analytics.traffic_sources.length > 0 && (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 mt-(--spacing-major) space-y-(--spacing-block)">
          <SectionHeading>{t("trafficTitle")}</SectionHeading>
          <ul className="space-y-(--spacing-cluster)">
            {r.analytics.traffic_sources.map((s) => (
              <li key={s.source} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="capitalize">{s.source.replace(/_/g, " ")}</span>
                  <span className="font-numeric tabular-nums text-muted-foreground">
                    {s.views}{" "}
                    <span className="text-muted-foreground/60">({s.pct}%)</span>
                  </span>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-foreground/70 rounded-full"
                    style={{ width: `${Math.max(2, s.pct)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Lead summary (medium, table-like) ────────────────────── */}
      {showLeads && data.leads.length > 0 && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-(--spacing-major)">
          <OwnerSafeLeadTable
            leads={data.leads}
            title={t("leadsTitle")}
            privacyNote={t("leadsPrivacyNote")}
          />
        </div>
      )}

      {/* ── Listing quality (medium) ─────────────────────────────── */}
      {r && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-(--spacing-major) space-y-(--spacing-block)">
          <SectionHeading>{t("qualityTitle")}</SectionHeading>
          <ListingQualityChecklist
            checks={r.listing_quality.checks}
            completeness_pct={r.listing_quality.completeness_pct}
          />
        </div>
      )}

      {/* ── Recommended next steps (narrow, ordered list) ────────── */}
      {showRecs && r && r.narrative.recommended_next_steps.length > 0 && (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 mt-(--spacing-major)">
          <RecommendationCards
            steps={r.narrative.recommended_next_steps}
            title={t("stepsTitle")}
          />
        </div>
      )}

      {/* ── Owner message (editorial pull-quote, not a card) ─────── */}
      {r?.narrative.owner_message && (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 mt-(--spacing-major)">
          <figure className="border-y border-border py-(--spacing-block) sm:py-(--spacing-section)">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
              {t("ownerMessageTitle")}
            </p>
            <blockquote className="text-lg sm:text-xl font-heading leading-snug whitespace-pre-line">
              {r.narrative.owner_message}
            </blockquote>
          </figure>
        </div>
      )}

      {/* ── Disclaimer (footnote, plain text) ────────────────────── */}
      {r?.narrative.disclaimer && (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 mt-(--spacing-section)">
          <p className="text-xs leading-relaxed text-muted-foreground border-t border-dashed border-border pt-(--spacing-cluster)">
            {r.narrative.disclaimer}
          </p>
        </div>
      )}

      {/* ── Agent signature (medium width) ───────────────────────── */}
      {data.agent && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-(--spacing-major)">
          <AgentSignatureBlock
            agent={data.agent}
            propertyTitle={property?.title}
            preparedAt={data.last_generated_at ?? data.created_at}
          />
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 mt-(--spacing-section) space-y-(--spacing-cluster)">
        <LegalDisclaimer variant="price" tone="note" />
        <p className="text-[11px] text-center text-muted-foreground">{t("footerNote")}</p>
      </div>
    </article>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-medium">
      {children}
    </h2>
  )
}

function NarrativeSection({ title, body }: { title: string; body: string }) {
  if (!body) return null
  return (
    <section className="space-y-1.5">
      <h3 className="text-base font-heading font-semibold leading-tight">
        {title}
      </h3>
      <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">
        {body}
      </p>
    </section>
  )
}
