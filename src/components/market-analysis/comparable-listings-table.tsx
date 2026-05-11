"use client"

import { useTranslations } from "next-intl"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline"
import { formatPrice } from "@/lib/utils"
import type { MarketReportComparable } from "@/types"

interface Props {
  comparables: MarketReportComparable[]
  /** Show only excluded ones (different visual treatment). */
  excludedView?: boolean
}

export function ComparableListingsTable({ comparables, excludedView = false }: Props) {
  const t = useTranslations("marketReportDetail.comparablesTable")

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("title")}</TableHead>
          <TableHead className="hidden md:table-cell">{t("source")}</TableHead>
          <TableHead className="hidden lg:table-cell">{t("location")}</TableHead>
          <TableHead className="text-right">{t("price")}</TableHead>
          <TableHead className="hidden md:table-cell text-right">{t("area")}</TableHead>
          <TableHead className="hidden md:table-cell text-right">{t("ppm2")}</TableHead>
          <TableHead className="hidden lg:table-cell text-right">{t("beds")}</TableHead>
          <TableHead className="hidden lg:table-cell text-right">{t("baths")}</TableHead>
          {!excludedView && (
            <TableHead className="text-right">{t("score")}</TableHead>
          )}
          {excludedView && (
            <TableHead>Reason</TableHead>
          )}
          <TableHead className="text-right">{t("actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {comparables.map((c) => (
          <TableRow key={c.id} className={c.is_outlier ? "opacity-60" : ""}>
            <TableCell className="text-sm font-medium max-w-[280px] truncate">
              {c.title ?? "—"}
              {c.is_outlier && !excludedView && (
                <Badge variant="outline" className="ml-2 text-[10px]">outlier</Badge>
              )}
            </TableCell>
            <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
              {c.source_name ?? "—"}
            </TableCell>
            <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
              {c.location_text ?? c.canton ?? "—"}
            </TableCell>
            <TableCell className="text-sm font-numeric text-right">
              {c.price != null && c.currency ? formatPrice(Number(c.price), c.currency) : "—"}
            </TableCell>
            <TableCell className="hidden md:table-cell text-sm font-numeric text-right">
              {c.built_area_m2 != null ? `${c.built_area_m2}` : "—"}
            </TableCell>
            <TableCell className="hidden md:table-cell text-sm font-numeric text-right">
              {c.price_per_m2 != null ? Math.round(Number(c.price_per_m2)) : "—"}
            </TableCell>
            <TableCell className="hidden lg:table-cell text-sm font-numeric text-right">
              {c.bedrooms ?? "—"}
            </TableCell>
            <TableCell className="hidden lg:table-cell text-sm font-numeric text-right">
              {c.bathrooms ?? "—"}
            </TableCell>
            {!excludedView && (
              <TableCell className="text-sm font-numeric text-right">
                {c.similarity_score != null ? `${Math.round(Number(c.similarity_score))}%` : "—"}
              </TableCell>
            )}
            {excludedView && (
              <TableCell className="text-xs text-muted-foreground">
                {c.exclusion_reason ?? "—"}
              </TableCell>
            )}
            <TableCell className="text-right">
              {c.listing_url && (
                <a
                  href={c.listing_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  aria-label={t("openLink")}
                >
                  <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                </a>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
