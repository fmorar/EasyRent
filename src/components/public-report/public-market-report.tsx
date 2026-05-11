"use client"

import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { formatPrice } from "@/lib/utils"
import { LegalDisclaimer } from "@/components/shared/legal-disclaimer"
import { PriceDistributionChart } from "@/components/public-report/price-distribution-chart"
import {
  PublicComparablesList,
  type PublicComparable,
} from "@/components/public-report/public-comparables-list"
import {
  AgentSignatureBlock, type AgentSignatureProps,
} from "@/components/public-report/agent-signature-block"
import { SiteAnalysisCard } from "@/components/public-report/site-analysis-card"
import type { OpenAIMarketReport } from "@/lib/market-analysis/types"
import type { SiteAnalysis } from "@/lib/market-analysis/site-analysis-service"

export interface PublicReportData {
  id:                    string
  created_at:            string
  report_type:           "sale" | "rent"
  report_locale:         "es" | "en"
  currency:              string
  recommended_price:     number | null
  recommended_price_min: number | null
  recommended_price_max: number | null
  confidence_score:      number | null
  report_json:           OpenAIMarketReport | null
  pdf_path:              string | null
  /** Top comparables surfaced to the owner (max 10, ordered by similarity). */
  comparables?:          PublicComparable[]
  /** Profile of the agent who prepared the report — drives the signature block. */
  agent?:                AgentSignatureProps["agent"] | null
  property: {
    title:           string
    slug:            string
    /** Cover photo URL — first photo or the one marked is_cover. */
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
}

interface Props {
  data:           PublicReportData
  preparedByName?: string | null
  /** Hides the "Download PDF" button when used in the dashboard preview. */
  hidePdfButton?:  boolean
}

export function PublicMarketReport({ data, preparedByName, hidePdfButton }: Props) {
  const t       = useTranslations("marketReportPublic")
  const ai      = data.report_json
  const property = data.property
  const currency = data.currency

  // Build the chart points from the visible comparables
  const chartPoints = (data.comparables ?? [])
    .filter((c): c is PublicComparable & { price: number } => c.price != null && c.price > 0)
    .map((c) => ({
      label: c.title ?? undefined,
      value: c.price,
      meta:  c.built_area_m2 != null ? `${c.built_area_m2} m²` : undefined,
    }))

  return (
    <article className="space-y-8">
      {/* Cover photo (when the property has photos) */}
      {property?.cover_url && (
        <div className="relative w-full aspect-[16/9] sm:aspect-[2/1] overflow-hidden rounded-xl bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={property.cover_url}
            alt={property.title}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Cover header */}
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("coverEyebrow")}</p>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold leading-tight">
          {property?.title ?? t("metaTitle")}
        </h1>
        {property?.display_address && (
          <p className="text-sm text-muted-foreground">{property.display_address}</p>
        )}
        {/* Subtle "Preparado por" row for context above the fold; the
            full signature with CTAs lives at the bottom. */}
        {(data.agent ?? preparedByName) && (
          <p className="text-xs text-muted-foreground">
            {t("preparedBy")}:{" "}
            <span className="font-medium text-foreground">
              {data.agent?.full_name ?? preparedByName}
            </span>
            {" · "}
            {t("preparedOn")}: {new Date(data.created_at).toLocaleDateString()}
          </p>
        )}
      </header>

      {/* Recommended price card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-6 space-y-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("recommendedPrice")}</p>
          <p className="text-4xl sm:text-5xl font-heading font-bold font-numeric text-foreground">
            {data.recommended_price != null ? formatPrice(data.recommended_price, currency) : "—"}
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">{t("rangeLabel")}</p>
              <p className="font-numeric">
                {data.recommended_price_min != null && data.recommended_price_max != null
                  ? `${formatPrice(data.recommended_price_min, currency)} – ${formatPrice(data.recommended_price_max, currency)}`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("confidenceLabel")}</p>
              <p>
                {ai?.confidence_label ?? "—"}
                {data.confidence_score != null && (
                  <span className="ml-2 text-muted-foreground font-numeric text-sm">
                    ({Math.round(data.confidence_score)}%)
                  </span>
                )}
              </p>
            </div>
          </div>
          {!hidePdfButton && data.pdf_path && (
            <div className="pt-2">
              <a
                href={`/api/market-reports/${data.id}/pdf?token=public`}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
              >
                {t("downloadPdf")}
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Property summary */}
      {property && (
        <section className="space-y-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("coverPropertyLabel")}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{property.property_type}</Badge>
            <Badge variant="secondary">{property.listing_type}</Badge>
            {property.bedrooms != null && <Badge variant="outline">{property.bedrooms} hab.</Badge>}
            {property.bathrooms != null && <Badge variant="outline">{property.bathrooms} bn.</Badge>}
            {property.parking_spaces != null && <Badge variant="outline">{property.parking_spaces} pq.</Badge>}
            {property.area_sqm != null && <Badge variant="outline">{property.area_sqm} m²</Badge>}
          </div>
        </section>
      )}

      <Separator />

      {/* AI sections */}
      {ai && (
        <>
          <Section title={t("executiveSummary")} body={ai.executive_summary} />
          <Section title={t("marketPosition")}   body={ai.market_position} />

          {/* Market comparison — chart + top comparables list. We surface
              this BEFORE the competitive_summary text so the owner sees
              the actual evidence first, then the AI-written narrative. */}
          {chartPoints.length > 0 && data.recommended_price != null && (
            <section className="space-y-3">
              <header className="space-y-1">
                <h2 className="text-base font-heading font-semibold">{t("marketComparison")}</h2>
                <p className="text-xs text-muted-foreground">{t("marketComparisonDesc")}</p>
              </header>
              <PriceDistributionChart
                points={chartPoints}
                recommended={data.recommended_price}
                recommendedMin={data.recommended_price_min ?? undefined}
                recommendedMax={data.recommended_price_max ?? undefined}
                currency={currency}
              />
            </section>
          )}

          {data.comparables && data.comparables.length > 0 && (
            <PublicComparablesList
              comparables={data.comparables}
              fallbackCurrency={currency}
            />
          )}

          <Section title={t("comparableSummary")} body={ai.competitive_summary} />
          <Section title={t("locationInsights")}  body={ai.location_insights} />

          {/* Deterministic site analysis from public maps (OSM).
              Sits between the AI-written location narrative and the
              amenities text — gives the reader the hard data right
              after the prose context. */}
          <SiteAnalysisCard site={(ai.site_analysis ?? null) as SiteAnalysis | null} />

          <Section title={t("amenitiesInsights")} body={ai.amenities_insights} />

          {/* Pricing scenarios */}
          <section className="space-y-3">
            <h2 className="text-base font-heading font-semibold">{t("pricingScenarios")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Scenario label={t("scenarioAggressive")}   price={ai.pricing_scenarios.aggressive.price}
                        currency={currency} desc={ai.pricing_scenarios.aggressive.description} />
              <Scenario label={t("scenarioBalanced")}     price={ai.pricing_scenarios.balanced.price}
                        currency={currency} desc={ai.pricing_scenarios.balanced.description} highlighted />
              <Scenario label={t("scenarioAspirational")} price={ai.pricing_scenarios.aspirational.price}
                        currency={currency} desc={ai.pricing_scenarios.aspirational.description} />
            </div>
          </section>

          {/* Strategy */}
          <Card>
            <CardHeader><CardTitle className="text-base">{t("strategy")}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>{ai.suggested_listing_strategy.strategy_explanation}</p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">{t("recommendedPrice")}</p>
                  <p className="font-numeric font-semibold">
                    {formatPrice(ai.suggested_listing_strategy.initial_listing_price, currency)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("negotiationFloor")}</p>
                  <p className="font-numeric font-semibold">
                    {formatPrice(ai.suggested_listing_strategy.negotiation_floor, currency)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("reviewAfterDays")}</p>
                  <p className="font-numeric font-semibold">{ai.suggested_listing_strategy.review_after_days}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Risks + opportunities */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BulletCard title={t("risks")}         items={ai.risks} />
            <BulletCard title={t("opportunities")} items={ai.opportunities} />
          </div>

          <Section title={t("methodology")} body={ai.methodology} />

          {ai.limitations.length > 0 && (
            <BulletCard title={t("limitations")} items={ai.limitations} />
          )}

          {/* Disclaimer */}
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("disclaimer")}</p>
              <p className="text-xs leading-relaxed">{ai.disclaimer}</p>
            </CardContent>
          </Card>
        </>
      )}

      {/* Signed by the agent who prepared the report */}
      {data.agent && (
        <AgentSignatureBlock
          agent={data.agent}
          propertyTitle={property?.title}
          preparedAt={data.created_at}
        />
      )}

      <LegalDisclaimer variant="price" tone="note" />
      <p className="text-[11px] text-center text-muted-foreground">{t("footerNote")}</p>
    </article>
  )
}

function Section({ title, body }: { title: string; body: string }) {
  if (!body) return null
  return (
    <section className="space-y-2">
      <h2 className="text-base font-heading font-semibold">{title}</h2>
      <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{body}</p>
    </section>
  )
}

function BulletCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm list-disc pl-5">
          {items.map((it, i) => <li key={i}>{it}</li>)}
        </ul>
      </CardContent>
    </Card>
  )
}

function Scenario({ label, price, currency, desc, highlighted }: {
  label: string; price: number; currency: string; desc: string; highlighted?: boolean
}) {
  return (
    <Card className={highlighted ? "border-primary" : ""}>
      <CardContent className="p-4 space-y-1.5">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-xl font-numeric font-bold">{formatPrice(price, currency)}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
      </CardContent>
    </Card>
  )
}
