// ============================================================
// PDF service — owner-facing market report PDF
//
// Server-side. Uses @react-pdf/renderer (pure JS — no headless
// browser, deploys cleanly to Vercel). The PDF mirrors the public
// HTML report's structure but with print-optimized layout.
// ============================================================

import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
import React from "react"
import type { PublicReportData } from "@/components/public-report/public-market-report"
import type { SiteAnalysis } from "@/lib/market-analysis/site-analysis-service"

const styles = StyleSheet.create({
  page: {
    padding:    36,
    fontSize:   10,
    color:      "#222222",
    fontFamily: "Helvetica",
  },
  cover: {
    marginBottom: 24,
  },
  eyebrow: { fontSize: 8, letterSpacing: 1.4, color: "#929292", textTransform: "uppercase", marginBottom: 6 },
  h1: { fontSize: 22, fontWeight: 700, marginBottom: 8 },
  h2: { fontSize: 13, fontWeight: 700, marginTop: 18, marginBottom: 6 },
  small: { fontSize: 9, color: "#929292" },
  priceCard: {
    backgroundColor: "#f7f7f7",
    borderRadius: 6,
    padding: 16,
    marginBottom: 18,
  },
  priceLabel: { fontSize: 8, letterSpacing: 1.4, color: "#929292", textTransform: "uppercase" },
  priceBig:   { fontSize: 30, fontWeight: 700, color: "#222222", marginVertical: 6 },
  rowSplit:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  body:       { fontSize: 10, lineHeight: 1.5, color: "#3f3f3f" },
  bullet:     { fontSize: 10, marginBottom: 3, marginLeft: 10 },
  scenarios:  { flexDirection: "row", gap: 8, marginTop: 10 },
  scenarioCard: {
    flex: 1,
    border: "1pt solid #dddddd",
    borderRadius: 4,
    padding: 8,
  },
  scenarioPrice: { fontSize: 14, fontWeight: 700, marginVertical: 4 },
  // Site analysis blocks
  siteChips:    { flexDirection: "row", gap: 6, marginVertical: 6, flexWrap: "wrap" },
  siteChip: {
    border: "1pt solid #dddddd",
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
    fontSize: 9,
  },
  siteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottom: "0.5pt solid #eeeeee",
  },
  siteRowLabel: { fontSize: 9.5, color: "#3f3f3f" },
  siteRowDist:  { fontSize: 9.5, color: "#222222", fontWeight: 700 },
  siteCountsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  siteCountTile: {
    width: "23%",
    backgroundColor: "#f7f7f7",
    borderRadius: 4,
    padding: 6,
  },
  siteCountValue: { fontSize: 14, fontWeight: 700 },
  siteCountLabel: { fontSize: 8, color: "#929292" },
  disclaimer: {
    marginTop: 24,
    padding: 10,
    fontSize: 8.5,
    color: "#6a6a6a",
    backgroundColor: "#f7f7f7",
    borderRadius: 4,
  },
})

function fmt(n: number | null | undefined, currency: string): string {
  if (n == null) return "—"
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0 }).format(n)
}

export async function renderMarketReportPdf(data: PublicReportData): Promise<Buffer> {
  const ai = data.report_json
  const property = data.property
  const currency = data.currency

  const doc = React.createElement(
    Document,
    {},
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      // Cover
      React.createElement(View, { style: styles.cover },
        React.createElement(Text, { style: styles.eyebrow }, "Market analysis"),
        React.createElement(Text, { style: styles.h1 }, property?.title ?? "Property"),
        property?.display_address &&
          React.createElement(Text, { style: styles.small }, property.display_address),
      ),
      // Recommended price
      React.createElement(View, { style: styles.priceCard },
        React.createElement(Text, { style: styles.priceLabel }, "Recommended price"),
        React.createElement(Text, { style: styles.priceBig }, fmt(data.recommended_price, currency)),
        React.createElement(View, { style: styles.rowSplit },
          React.createElement(Text, { style: styles.small },
            `Range: ${fmt(data.recommended_price_min, currency)} – ${fmt(data.recommended_price_max, currency)}`),
          React.createElement(Text, { style: styles.small },
            `Confidence: ${ai?.confidence_label ?? "—"}${
              data.confidence_score != null ? ` (${Math.round(data.confidence_score)}%)` : ""
            }`),
        ),
      ),

      ai && React.createElement(React.Fragment, null,
        section("Executive summary", ai.executive_summary),
        section("Market position",   ai.market_position),
        section("Location insights", ai.location_insights),
        // Deterministic site analysis (OSM) — distances + counts +
        // walkability. Sits right after the AI location prose so the
        // owner sees the supporting evidence immediately.
        siteAnalysisBlock(
          (ai.site_analysis ?? null) as SiteAnalysis | null,
          data.report_locale,
        ),
        section("Pricing rationale", ai.pricing_rationale),
        section("Owner-friendly explanation", ai.owner_friendly_explanation),

        // Scenarios
        React.createElement(Text, { style: styles.h2 }, "Pricing scenarios"),
        React.createElement(View, { style: styles.scenarios },
          scenarioBlock("Aggressive",   ai.pricing_scenarios.aggressive.price,   ai.pricing_scenarios.aggressive.description, currency),
          scenarioBlock("Balanced",     ai.pricing_scenarios.balanced.price,     ai.pricing_scenarios.balanced.description,   currency),
          scenarioBlock("Aspirational", ai.pricing_scenarios.aspirational.price, ai.pricing_scenarios.aspirational.description, currency),
        ),

        // Strategy
        React.createElement(Text, { style: styles.h2 }, "Suggested strategy"),
        React.createElement(Text, { style: styles.body }, ai.suggested_listing_strategy.strategy_explanation),

        // Risks/opps
        bulletSection("Risks",         ai.risks),
        bulletSection("Opportunities", ai.opportunities),

        section("Methodology", ai.methodology),
        bulletSection("Limitations", ai.limitations),

        React.createElement(View, { style: styles.disclaimer },
          React.createElement(Text, { style: styles.body }, ai.disclaimer),
        ),
      ),
    ),
  )

  return renderToBuffer(doc) as Promise<Buffer>
}

function section(title: string, body: string | undefined) {
  if (!body) return null
  return React.createElement(React.Fragment, { key: title },
    React.createElement(Text, { style: styles.h2 }, title),
    React.createElement(Text, { style: styles.body }, body),
  )
}

function bulletSection(title: string, items: string[]) {
  if (!items?.length) return null
  return React.createElement(React.Fragment, { key: title },
    React.createElement(Text, { style: styles.h2 }, title),
    ...items.map((it, i) =>
      React.createElement(Text, { key: i, style: styles.bullet }, `• ${it}`),
    ),
  )
}

function scenarioBlock(label: string, price: number, desc: string, currency: string) {
  return React.createElement(View, { style: styles.scenarioCard, key: label },
    React.createElement(Text, { style: styles.priceLabel }, label),
    React.createElement(Text, { style: styles.scenarioPrice }, fmt(price, currency)),
    React.createElement(Text, { style: { fontSize: 8.5, color: "#6a6a6a" } }, desc),
  )
}

// ── Site analysis (OSM) block ────────────────────────────────────
// Mirrors the on-screen `<SiteAnalysisCard>`. Print-friendly: chips
// for tier + environment, two-column distance rows, count tiles,
// and a small disclaimer. Returns null when site is unavailable so
// the PDF doesn't show an empty section.
function siteAnalysisBlock(site: SiteAnalysis | null, locale: "es" | "en") {
  if (!site) return null
  const L = locale === "en" ? PDF_L.en : PDF_L.es
  const tierLabel =
    site.walkability.tier === "high"   ? L.tierHigh   :
    site.walkability.tier === "medium" ? L.tierMedium : L.tierLow
  const envLabel =
    site.environment === "commercial"        ? L.envCommercial :
    site.environment === "residential_mixed" ? L.envMixed      :
    site.environment === "residential_quiet" ? L.envQuiet      : L.envUnknown

  const distRows: Array<[string, { name: string; distance_m: number } | undefined]> = [
    [L.nearestHospital,    site.nearest.hospital],
    [L.nearestSchool,      site.nearest.school],
    [L.nearestSupermarket, site.nearest.supermarket],
    [L.nearestPark,        site.nearest.park],
    [L.nearestTransit,     site.nearest.transit],
    [L.nearestRestaurant,  site.nearest.restaurant],
    [L.nearestPharmacy,    site.nearest.pharmacy],
    [L.nearestBank,        site.nearest.bank],
  ]
  if (site.nearest.main_road) {
    distRows.push([L.nearestRoad, {
      name:       site.nearest.main_road.name,
      distance_m: site.nearest.main_road.distance_m,
    }])
  }

  const counts: Array<[string, number]> = [
    [L.countSupermarkets, site.counts.r1km.supermarkets],
    [L.countSchools,      site.counts.r1km.schools],
    [L.countParks,        site.counts.r1km.parks],
    [L.countRestaurants,  site.counts.r1km.restaurants],
    [L.countPharmacies,   site.counts.r1km.pharmacies],
    [L.countBanks,        site.counts.r1km.banks],
    [L.countTransit,      site.counts.r1km.transit_stops],
    [L.countMalls,        site.counts.r1km.malls],
  ]

  return React.createElement(React.Fragment, { key: "site" },
    React.createElement(Text, { style: styles.h2 }, L.title),
    React.createElement(Text, { style: { fontSize: 9, color: "#6a6a6a" } }, L.subtitle),
    React.createElement(View, { style: styles.siteChips },
      React.createElement(Text, { style: styles.siteChip },
        `${L.walkability}: ${tierLabel} (${site.walkability.score}/100)`),
      React.createElement(Text, { style: styles.siteChip }, envLabel),
    ),
    // Distances
    React.createElement(Text, { style: { ...styles.h2, fontSize: 11, marginTop: 8 } }, L.nearestHeading),
    ...distRows.map(([label, poi], i) =>
      React.createElement(View, { style: styles.siteRow, key: `d${i}` },
        React.createElement(Text, { style: styles.siteRowLabel }, label),
        React.createElement(Text, { style: styles.siteRowDist },
          poi ? `${formatDistPdf(poi.distance_m)} · ${truncate(poi.name, 28)}` : "—"),
      ),
    ),
    // POI counts
    React.createElement(Text, { style: { ...styles.h2, fontSize: 11, marginTop: 10 } }, L.countsHeading),
    React.createElement(View, { style: styles.siteCountsRow },
      ...counts.map(([label, value], i) =>
        React.createElement(View, { style: styles.siteCountTile, key: `c${i}` },
          React.createElement(Text, { style: styles.siteCountValue }, String(value)),
          React.createElement(Text, { style: styles.siteCountLabel }, label),
        ),
      ),
    ),
    // Disclaimer
    React.createElement(Text, {
      style: { fontSize: 8, color: "#929292", marginTop: 10, lineHeight: 1.4 },
    }, site.coverage_note ? `${site.coverage_note} ${L.disclaimer}` : L.disclaimer),
  )
}

function formatDistPdf(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

// PDF labels — kept inline so we don't import the next-intl runtime
// in a server-only PDF render path.
const PDF_L = {
  es: {
    title:             "Análisis del sitio",
    subtitle:          "Servicios, conectividad y entorno · datos públicos de OpenStreetMap",
    walkability:       "Caminabilidad",
    tierHigh:          "Alta",
    tierMedium:        "Media",
    tierLow:           "Baja",
    envCommercial:     "Entorno comercial / mixto",
    envMixed:          "Residencial mixto",
    envQuiet:          "Residencial tranquilo",
    envUnknown:        "Sin clasificar",
    nearestHeading:    "Distancias a servicios clave",
    nearestHospital:   "Hospital o clínica",
    nearestSchool:     "Escuela",
    nearestSupermarket:"Supermercado",
    nearestPark:       "Parque",
    nearestTransit:    "Transporte público",
    nearestRestaurant: "Restaurantes",
    nearestPharmacy:   "Farmacia",
    nearestBank:       "Banco / cajero",
    nearestRoad:       "Vía principal",
    countsHeading:     "Puntos de interés en 1 km",
    countSupermarkets: "Supermercados",
    countSchools:      "Escuelas",
    countParks:        "Parques",
    countRestaurants:  "Restaurantes",
    countPharmacies:   "Farmacias",
    countBanks:        "Bancos",
    countTransit:      "Transporte",
    countMalls:        "Centros com.",
    disclaimer:        "Datos aproximados de OpenStreetMap. La cobertura puede variar — verificá en sitio antes de tomar decisiones.",
  },
  en: {
    title:             "Site analysis",
    subtitle:          "Services, connectivity and surroundings · public data from OpenStreetMap",
    walkability:       "Walkability",
    tierHigh:          "High",
    tierMedium:        "Medium",
    tierLow:           "Low",
    envCommercial:     "Commercial / mixed-use",
    envMixed:          "Mixed residential",
    envQuiet:          "Quiet residential",
    envUnknown:        "Unclassified",
    nearestHeading:    "Distance to key services",
    nearestHospital:   "Hospital or clinic",
    nearestSchool:     "School",
    nearestSupermarket:"Supermarket",
    nearestPark:       "Park",
    nearestTransit:    "Public transit",
    nearestRestaurant: "Restaurants",
    nearestPharmacy:   "Pharmacy",
    nearestBank:       "Bank / ATM",
    nearestRoad:       "Main road",
    countsHeading:     "Points of interest within 1 km",
    countSupermarkets: "Supermarkets",
    countSchools:      "Schools",
    countParks:        "Parks",
    countRestaurants:  "Restaurants",
    countPharmacies:   "Pharmacies",
    countBanks:        "Banks",
    countTransit:      "Transit",
    countMalls:        "Malls",
    disclaimer:        "Approximate data from OpenStreetMap. Coverage varies — verify on site before making decisions.",
  },
} as const
