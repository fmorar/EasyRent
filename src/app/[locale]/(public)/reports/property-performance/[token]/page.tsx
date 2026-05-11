// ============================================================
// Public, owner-facing property performance report
//
// Anonymous (no auth). Hits the SECURITY DEFINER RPC via the
// /api/public/performance-reports/[token] route — privacy-safe
// data only (no full names, phones, emails, internal notes).
// ============================================================

import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { getTranslations } from "next-intl/server"
import {
  PublicPropertyPerformanceReport,
  type PublicPerformanceReportData,
} from "@/components/public-report/public-property-performance-report"
import type { Metadata } from "next"

interface Props { params: Promise<{ token: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await params
  const t = await getTranslations("performanceReports.public")
  return {
    title:  t("metaTitle"),
    robots: { index: false, follow: false },
  }
}

async function fetchReport(token: string): Promise<PublicPerformanceReportData | null> {
  const h = await headers()
  const host  = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? "http"
  const url   = `${proto}://${host}/api/public/performance-reports/${token}`

  try {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return null
    return (await res.json()) as PublicPerformanceReportData
  } catch {
    return null
  }
}

export default async function PublicPerformanceReportPage({ params }: Props) {
  const { token } = await params
  const data = await fetchReport(token)
  if (!data) notFound()

  // The component decides its own widths per block (full-bleed cover,
  // narrow body for narrative, wider for metrics ribbon). The page
  // wrapper just provides the page gutters and bottom breathing room.
  return (
    <main className="pb-(--spacing-major)">
      <PublicPropertyPerformanceReport data={data} />
    </main>
  )
}
