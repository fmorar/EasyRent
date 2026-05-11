// ============================================================
// Public, owner-facing market report
//
// Lives outside auth. Hits the SECURITY DEFINER RPC via the
// /api/public/market-reports/[token] route handler so we don't
// leak the service role key here.
// ============================================================

import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { getTranslations } from "next-intl/server"
import { PublicMarketReport, type PublicReportData } from "@/components/public-report/public-market-report"
import type { Metadata } from "next"

interface Props { params: Promise<{ token: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await params  // satisfy Next's typed-route requirement without using the value
  const t = await getTranslations("marketReportPublic")
  // Title intentionally generic — actual property title is in body.
  // Noindex: owner reports are private even though shareable by link.
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false },
  }
}

async function fetchReport(token: string): Promise<PublicReportData | null> {
  const h = await headers()
  // Build absolute URL — required for fetch from a Server Component
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? "http"
  const url = `${proto}://${host}/api/public/market-reports/${token}`

  try {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return null
    return (await res.json()) as PublicReportData
  } catch {
    return null
  }
}

export default async function PublicMarketReportPage({ params }: Props) {
  const { token } = await params
  const data = await fetchReport(token)
  if (!data) notFound()

  // Page wrapper provides gutters + bottom breathing room only. The
  // report component decides its own widths per block (cover photo /
  // recommended-price card stay readable, comparables/chart can flex
  // wider on desktop). Same treatment as the performance report.
  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-(--spacing-section) sm:py-(--spacing-major) pb-(--spacing-major)">
      <PublicMarketReport data={data} />
    </main>
  )
}
