import Link from "next/link"
import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getTranslations } from "next-intl/server"
import { ArrowLeftIcon } from "@heroicons/react/24/outline"
import { NewPerformanceReportForm } from "@/components/performance/new-performance-report-form"
import type { PropertyOption } from "@/components/market-analysis/property-selector"

export default async function NewPerformanceReportPage() {
  const { profile } = await requireAuth()
  const supabase    = await createClient()
  const t           = await getTranslations("performanceReports.form")

  // Same restriction as market-analysis: agents only run reports on
  // properties they personally created.
  const { data: propertiesRaw } = await supabase
    .from("properties")
    .select(`
      id, title, slug, property_type, listing_type,
      bedrooms, bathrooms, parking_spaces, area_sqm, maintenance_fee,
      price, currency, display_address,
      property_photos(url, is_cover, order_index)
    `)
    .eq("created_by", profile.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  type RawPhoto = { url: string; is_cover: boolean; order_index: number }
  const properties: PropertyOption[] = (propertiesRaw ?? []).map((p) => {
    const row = p as PropertyOption & { property_photos?: RawPhoto[] | null }
    const photos = (row.property_photos ?? []) as RawPhoto[]
    const cover = photos.find((x) => x.is_cover)
      ?? [...photos].sort((a, b) => a.order_index - b.order_index)[0]
      ?? null
    return { ...row, cover_url: cover?.url ?? null }
  })

  return (
    <div className="mx-auto w-full max-w-3xl py-(--spacing-block) sm:py-(--spacing-section) space-y-(--spacing-section)">
      <header className="space-y-1">
        <Link
          href="/performance-reports"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors duration-(--duration-state) ease-(--ease-out-quart)"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          {t("title")}
        </Link>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">{t("subtitle")}</p>
      </header>

      <NewPerformanceReportForm properties={properties} />
    </div>
  )
}
