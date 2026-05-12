import Link from "next/link"
import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getLocale, getTranslations } from "next-intl/server"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlusIcon } from "@heroicons/react/24/outline"
import { EmptyState } from "@/components/shared/empty-state"
import { ChartBarIcon } from "@heroicons/react/24/outline"
import { MarketAnalysisStatusBadge } from "@/components/market-analysis/market-analysis-status-badge"
import { ReportActions } from "@/components/market-analysis/report-actions"
import { formatPrice } from "@/lib/utils"
import type { MarketReport } from "@/types"

type Row = MarketReport & {
  property: { title: string; slug: string } | null
  creator:  { full_name: string } | null
}

export default async function MarketAnalysisListPage() {
  const { profile } = await requireAuth()
  const supabase = await createClient()
  const t        = await getTranslations("marketAnalysis")
  const tOp      = await getTranslations("marketAnalysis.operation")
  const tCol     = await getTranslations("marketAnalysis.table")
  const locale   = await getLocale()
  const dateLocale = locale === "es" ? "es-CR" : "en-US"

  // Scope explicitly: my own reports + reports on properties shared TO
  // me (approved). Same defense-in-depth as /properties and
  // /performance-reports — RLS allows it, the query asks for it.
  const { data: sharedInRows } = await supabase
    .from("property_shares")
    .select("property_id")
    .eq("shared_with", profile.id)
    .eq("status",      "approved")
    .is("deleted_at",  null)

  const sharedInIds = (sharedInRows ?? []).map((r) => r.property_id)
  const scope = sharedInIds.length > 0
    ? `created_by.eq.${profile.id},property_id.in.(${sharedInIds.join(",")})`
    : `created_by.eq.${profile.id}`

  const { data: reportsRaw } = await supabase
    .from("market_reports")
    .select(`
      *,
      property:properties(title, slug),
      creator:profiles!market_reports_created_by_fkey(full_name)
    `)
    .or(scope)
    .order("created_at", { ascending: false })

  const reports = (reportsRaw ?? []) as Row[]

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(dateLocale, { day: "2-digit", month: "short", year: "numeric" })

  const fmtRange = (min: number | null, max: number | null, currency: string) => {
    if (min == null || max == null) return "—"
    return `${formatPrice(min, currency)} – ${formatPrice(max, currency)}`
  }

  return (
    <div className="space-y-(--spacing-section)">
      <div className="flex items-start sm:items-center justify-between gap-3 sm:gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{t("subtitle")}</p>
        </div>
        <Link
          href="/market-analysis/new"
          className={buttonVariants() + " shrink-0 w-full sm:w-auto justify-center"}
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          {t("newAnalysis")}
        </Link>
      </div>

      {reports.length === 0 ? (
        <EmptyState
          icon={<ChartBarIcon className="h-8 w-8" />}
          title={t("empty.title")}
          message={t("empty.body")}
          action={
            <Link href="/market-analysis/new" className={buttonVariants({ variant: "default" })}>
              <PlusIcon className="h-4 w-4 mr-2" />
              {t("newAnalysis")}
            </Link>
          }
        />
      ) : (
        <>
          {/* ── Mobile (<sm): stacked cards. Tables don't read well on
              phones — even with horizontal scroll the user has to swipe
              for every row. Cards give each report a tappable surface. */}
          <div className="sm:hidden space-y-3">
            {reports.map((r) => (
              <MobileReportCard
                key={r.id}
                r={r}
                tOp={tOp}
                priceLabel={tCol("recommended")}
                confidenceLabel={tCol("confidence")}
                fmtDate={fmtDate}
                fmtRange={fmtRange}
                canManage={r.created_by === profile.id}
              />
            ))}
          </div>

          {/* ── ≥sm: traditional table */}
          <Card className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tCol("property")}</TableHead>
                  <TableHead>{tCol("operation")}</TableHead>
                  <TableHead>{tCol("recommended")}</TableHead>
                  <TableHead className="hidden md:table-cell">{tCol("range")}</TableHead>
                  <TableHead className="hidden md:table-cell">{tCol("confidence")}</TableHead>
                  <TableHead>{tCol("status")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{tCol("createdBy")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{tCol("createdAt")}</TableHead>
                  <TableHead className="text-right">{tCol("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r) => (
                  <TableRow key={r.id} className="transition-colors duration-150 ease-out">
                    <TableCell className="max-w-[200px] md:max-w-[260px] lg:max-w-none">
                      <Link
                        href={`/market-analysis/${r.id}`}
                        className="font-medium text-sm hover:underline block truncate"
                        title={r.property?.title ?? r.title ?? undefined}
                      >
                        {r.property?.title ?? r.title ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{tOp(r.report_type)}</TableCell>
                    <TableCell className="text-sm font-numeric whitespace-nowrap">
                      {r.recommended_price != null ? formatPrice(r.recommended_price, r.currency) : "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground font-numeric whitespace-nowrap">
                      {fmtRange(r.recommended_price_min, r.recommended_price_max, r.currency)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm font-numeric whitespace-nowrap">
                      {r.confidence_score != null ? `${Math.round(r.confidence_score)}%` : "—"}
                    </TableCell>
                    <TableCell><MarketAnalysisStatusBadge status={r.status} /></TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground truncate max-w-[160px]">
                      {r.creator?.full_name ?? "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground font-numeric whitespace-nowrap">
                      {fmtDate(r.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ReportActions
                        report={{ id: r.id, status: r.status, public_token: r.public_token, pdf_path: r.pdf_path }}
                        canManage={r.created_by === profile.id}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  )
}

// ── Mobile-only card view ──────────────────────────────────────────
function MobileReportCard({
  r, tOp, priceLabel, confidenceLabel, fmtDate, fmtRange, canManage,
}: {
  r:               Row
  tOp:             (key: "sale" | "rent") => string
  priceLabel:      string
  confidenceLabel: string
  fmtDate:         (iso: string) => string
  fmtRange:        (min: number | null, max: number | null, currency: string) => string
  canManage:       boolean
}) {
  const propertyTitle = r.property?.title ?? r.title ?? "—"
  return (
    <Card className="p-4 space-y-3 hover:bg-muted/30 transition-colors duration-150 ease-out">
      <div className="flex items-start gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {tOp(r.report_type)}
          </span>
          <span className="text-muted-foreground">·</span>
          <MarketAnalysisStatusBadge status={r.status} />
        </div>
        <div className="shrink-0 -mt-1 -mr-1">
          <ReportActions
            report={{ id: r.id, status: r.status, public_token: r.public_token, pdf_path: r.pdf_path }}
            canManage={canManage}
          />
        </div>
      </div>

      <Link
        href={`/market-analysis/${r.id}`}
        className="block text-sm font-medium leading-snug hover:underline"
      >
        {propertyTitle}
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {priceLabel}
          </p>
          <p className="text-sm font-numeric font-semibold tabular-nums truncate">
            {r.recommended_price != null ? formatPrice(r.recommended_price, r.currency) : "—"}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {confidenceLabel}
          </p>
          <p className="text-sm font-numeric font-semibold tabular-nums">
            {r.confidence_score != null ? `${Math.round(r.confidence_score)}%` : "—"}
          </p>
        </div>
      </div>

      {r.recommended_price_min != null && r.recommended_price_max != null && (
        <p className="text-xs text-muted-foreground font-numeric tabular-nums truncate">
          {fmtRange(r.recommended_price_min, r.recommended_price_max, r.currency)}
        </p>
      )}

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-2 border-t">
        {r.creator?.full_name && (
          <>
            <span className="truncate">{r.creator.full_name}</span>
            <span>·</span>
          </>
        )}
        <span className="font-numeric tabular-nums shrink-0">{fmtDate(r.created_at)}</span>
      </div>
    </Card>
  )
}
