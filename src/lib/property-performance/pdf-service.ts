// ============================================================
// PDF service — owner-facing performance report PDF
//
// Uses @react-pdf/renderer. Same architecture as the market
// analysis PDF service: pure JS rendering, no headless browser,
// deploys cleanly on Vercel.
// ============================================================

import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
import React from "react"
import type { OwnerReportPayload } from "./types"

const styles = StyleSheet.create({
  page: {
    padding:    36,
    fontSize:   10,
    color:      "#222222",
    fontFamily: "Helvetica",
  },
  cover:       { marginBottom: 24 },
  eyebrow:     { fontSize: 8, letterSpacing: 1.4, color: "#929292", textTransform: "uppercase", marginBottom: 6 },
  h1:          { fontSize: 22, fontWeight: 700, marginBottom: 8 },
  h2:          { fontSize: 13, fontWeight: 700, marginTop: 18, marginBottom: 6 },
  small:       { fontSize: 9, color: "#929292" },
  body:        { fontSize: 10, lineHeight: 1.5, color: "#3f3f3f" },
  scoreCard:   { backgroundColor: "#f7f7f7", borderRadius: 6, padding: 16, marginBottom: 18 },
  scoreLabel:  { fontSize: 8, letterSpacing: 1.4, color: "#929292", textTransform: "uppercase" },
  scoreBig:    { fontSize: 32, fontWeight: 700, color: "#222222", marginVertical: 6 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 8, marginBottom: 16, gap: 6 },
  metricCard:  {
    width: "31%", border: "1pt solid #dddddd", borderRadius: 4,
    padding: 8, marginBottom: 6,
  },
  metricLabel: { fontSize: 8, color: "#929292", textTransform: "uppercase", letterSpacing: 1 },
  metricValue: { fontSize: 14, fontWeight: 700, marginTop: 4 },
  bullet:      { fontSize: 10, marginBottom: 3, marginLeft: 10 },
  step: {
    border: "1pt solid #dddddd", borderRadius: 4, padding: 8,
    marginBottom: 6,
  },
  stepTitle:   { fontSize: 11, fontWeight: 700 },
  stepDesc:    { fontSize: 9.5, color: "#6a6a6a", marginTop: 2 },
  disclaimer: {
    marginTop: 24, padding: 10, fontSize: 8.5, color: "#6a6a6a",
    backgroundColor: "#f7f7f7", borderRadius: 4,
  },
})

const STATUS_LABELS = {
  strong:          "Alto rendimiento",
  healthy:         "Rendimiento saludable",
  needs_attention: "Requiere atención",
  low_activity:    "Baja actividad",
} as const

export async function renderOwnerReportPdf(p: OwnerReportPayload): Promise<Buffer> {
  const doc = React.createElement(
    Document, {},
    React.createElement(
      Page, { size: "A4", style: styles.page },

      // Cover
      React.createElement(View, { style: styles.cover },
        React.createElement(Text, { style: styles.eyebrow }, "Reporte de desempeño"),
        React.createElement(Text, { style: styles.h1 }, p.subject.title),
        p.subject.display_address &&
          React.createElement(Text, { style: styles.small }, p.subject.display_address),
      ),

      // Score card
      React.createElement(View, { style: styles.scoreCard },
        React.createElement(Text, { style: styles.scoreLabel }, "Puntaje de desempeño"),
        React.createElement(Text, { style: styles.scoreBig }, `${p.performance_score}/100`),
        React.createElement(Text, { style: styles.body }, STATUS_LABELS[p.performance_status]),
      ),

      // Metrics grid
      React.createElement(Text, { style: styles.h2 }, "Métricas clave"),
      React.createElement(View, { style: styles.metricsGrid },
        metric("Vistas",           p.analytics.total_views),
        metric("Visitantes únicos", p.analytics.unique_visitors),
        metric("Leads",            p.funnel.total_leads),
        metric("Leads calificados",p.funnel.qualified_leads),
        metric("Citas agendadas",  p.funnel.appointments_scheduled),
        metric("Visitas",          p.funnel.visits_completed),
        metric("Tasa conversión",  `${(p.funnel.conversion_rate * 100).toFixed(1)}%`),
        metric("Días publicada",   p.period.days),
        metric("Calidad anuncio",  `${p.listing_quality.completeness_pct}%`),
      ),

      // Narrative sections
      section("Resumen ejecutivo", p.narrative.executive_summary),
      section("Por qué el desempeño es " + STATUS_LABELS[p.performance_status],
              p.narrative.performance_status_explanation),
      section("Tráfico y vistas",     p.narrative.traffic_summary),
      section("Calidad de los leads", p.narrative.lead_quality_summary),
      section("Citas y visitas",      p.narrative.appointment_summary),
      section("Preguntas frecuentes",  p.narrative.main_questions_summary),
      section("Principales objeciones", p.narrative.main_objections_summary),
      section("Estrategia de precio",  p.narrative.price_strategy_summary),
      section("Calidad del anuncio",   p.narrative.listing_quality_summary),

      // Recommended next steps
      React.createElement(Text, { style: styles.h2 }, "Próximos pasos recomendados"),
      ...p.narrative.recommended_next_steps.map((s, i) =>
        React.createElement(View, { key: i, style: styles.step },
          React.createElement(Text, { style: styles.stepTitle }, s.title),
          React.createElement(Text, { style: styles.stepDesc }, s.description),
        ),
      ),

      // Owner message + disclaimer
      section("Mensaje del agente", p.narrative.owner_message),
      React.createElement(View, { style: styles.disclaimer },
        React.createElement(Text, { style: styles.body }, p.narrative.disclaimer),
      ),
    ),
  )

  return renderToBuffer(doc) as Promise<Buffer>
}

function metric(label: string, value: number | string) {
  return React.createElement(View, { style: styles.metricCard, key: label },
    React.createElement(Text, { style: styles.metricLabel }, label),
    React.createElement(Text, { style: styles.metricValue }, String(value)),
  )
}

function section(title: string, body: string | undefined | null) {
  if (!body) return null
  return React.createElement(React.Fragment, { key: title },
    React.createElement(Text, { style: styles.h2 }, title),
    React.createElement(Text, { style: styles.body }, body),
  )
}
