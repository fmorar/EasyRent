import Link from "next/link"
import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getLocale, getTranslations } from "next-intl/server"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlusIcon, PresentationChartLineIcon } from "@heroicons/react/24/outline"
import { EmptyState } from "@/components/shared/empty-state"
import {
  PerformanceReportStatusBadge, PerformanceHealthBadge,
} from "@/components/performance/performance-status-badge"
import { PerformanceReportActions } from "@/components/performance/performance-report-actions"
import type { PropertyPerformanceReport } from "@/types"

type Row = PropertyPerformanceReport & {
  property: { title: string; slug: string } | null
}

export default async function PerformanceReportsListPage() {
  const { profile } = await requireAuth()
  const supabase = await createClient()
  const t        = await getTranslations("performanceReports")
  const tCol     = await getTranslations("performanceReports.table")
  const locale   = await getLocale()
  const dateLocale = locale === "es" ? "es-CR" : "en-US"

  // Scope explicitly to "reports I created" + "reports on properties
  // approved-shared TO me". Mirrors the /properties + /contracts
  // approach so an RLS-only future regression can't leak inventory
  // into this list.
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

  const { data: rowsRaw } = await supabase
    .from("property_performance_reports")
    .select(`
      *,
      property:properties(title, slug)
    `)
    .or(scope)
    .order("created_at", { ascending: false })

  const reports = (rowsRaw ?? []) as Row[]

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(dateLocale, {
      day: "2-digit", month: "short", year: "numeric",
    })

  // Pull a quick metric — total leads from each report's report_json
  // so the table shows real counts without an extra query per row.
  const metric = (r: Row, path: string[]): number => {
    let cur: unknown = r.report_json
    for (const p of path) {
      if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[p]
      } else return 0
    }
    return typeof cur === "number" ? cur : 0
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
          href="/performance-reports/new"
          className={buttonVariants() + " shrink-0 w-full sm:w-auto justify-center"}
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          {t("newReport")}
        </Link>
      </div>

      {reports.length === 0 ? (
        <EmptyState
          icon={<PresentationChartLineIcon className="h-8 w-8" />}
          title={t("empty.title")}
          message={t("empty.body")}
          action={
            <Link href="/performance-reports/new" className={buttonVariants({ variant: "default" })}>
              <PlusIcon className="h-4 w-4 mr-2" />
              {t("newReport")}
            </Link>
          }
        />
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="sm:hidden space-y-3">
            {reports.map((r) => (
              <Card key={r.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <PerformanceReportStatusBadge status={r.status} />
                    {r.performance_status && <PerformanceHealthBadge status={r.performance_status} />}
                  </div>
                  <div className="shrink-0 -mt-1 -mr-1">
                    <PerformanceReportActions
                      report={{
                        id: r.id, status: r.status,
                        public_token: r.public_token, pdf_path: r.pdf_path,
                      }}
                      canManage={r.created_by === profile.id}
                    />
                  </div>
                </div>
                <Link
                  href={`/performance-reports/${r.id}`}
                  className="block text-sm font-medium hover:underline"
                >
                  {r.property?.title ?? "—"}
                </Link>
                <div className="grid grid-cols-3 gap-2 pt-1 border-t">
                  <CardStat label={tCol("score")} value={r.performance_score ? Math.round(Number(r.performance_score)) : "—"} />
                  <CardStat label={tCol("views")} value={metric(r, ["analytics", "total_views"])} />
                  <CardStat label={tCol("leads")} value={metric(r, ["funnel", "total_leads"])} />
                </div>
                <p className="text-[11px] text-muted-foreground font-numeric tabular-nums">
                  {fmtDate(r.created_at)}
                </p>
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tCol("property")}</TableHead>
                  <TableHead>{tCol("score")}</TableHead>
                  <TableHead className="hidden md:table-cell">{tCol("status")}</TableHead>
                  <TableHead>{tCol("views")}</TableHead>
                  <TableHead>{tCol("leads")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{tCol("appointments")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{tCol("createdAt")}</TableHead>
                  <TableHead className="text-right">{tCol("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-[260px] lg:max-w-none">
                      <Link
                        href={`/performance-reports/${r.id}`}
                        className="font-medium text-sm hover:underline block truncate"
                      >
                        {r.property?.title ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm font-numeric tabular-nums">
                      {r.performance_score != null ? Math.round(Number(r.performance_score)) : "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-col gap-1">
                        <PerformanceReportStatusBadge status={r.status} />
                        {r.performance_status && <PerformanceHealthBadge status={r.performance_status} />}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-numeric tabular-nums">
                      {metric(r, ["analytics", "total_views"])}
                    </TableCell>
                    <TableCell className="text-sm font-numeric tabular-nums">
                      {metric(r, ["funnel", "total_leads"])}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm font-numeric tabular-nums">
                      {metric(r, ["funnel", "appointments_scheduled"])}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground font-numeric tabular-nums whitespace-nowrap">
                      {fmtDate(r.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <PerformanceReportActions report={{
                        id: r.id, status: r.status,
                        public_token: r.public_token, pdf_path: r.pdf_path,
                      }} />
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

function CardStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{label}</p>
      <p className="text-sm font-numeric font-semibold tabular-nums">{value}</p>
    </div>
  )
}
