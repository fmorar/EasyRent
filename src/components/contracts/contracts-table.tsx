"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { ContractStatusBadge } from "./contract-status-badge"
import { formatPrice } from "@/lib/utils"
import type { ContractListItem } from "@/types/contracts"
import type { ContractStatus } from "@/types"

interface Props {
  contracts: ContractListItem[]
}

export function ContractsTable({ contracts }: Props) {
  const t = useTranslations("contracts.table")
  if (contracts.length === 0) return null

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("contract")}</TableHead>
              <TableHead>{t("tenant")}</TableHead>
              <TableHead>{t("rent")}</TableHead>
              <TableHead>{t("startDate")}</TableHead>
              <TableHead>{t("status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.map((c) => (
              <TableRow key={c.id} className="hover:bg-muted/40 transition-colors">
                <TableCell className="font-medium">
                  <Link
                    href={`/contracts/${c.id}`}
                    className="hover:underline underline-offset-4"
                  >
                    {c.title || c.property_title || t("untitled")}
                  </Link>
                  {c.property_title && c.title !== c.property_title && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {c.property_title}
                    </p>
                  )}
                </TableCell>
                <TableCell>{c.tenant_name ?? "—"}</TableCell>
                <TableCell className="font-numeric tabular-nums">
                  {c.rent_amount && c.rent_currency
                    ? formatPrice(c.rent_amount, c.rent_currency)
                    : "—"}
                </TableCell>
                <TableCell className="font-numeric tabular-nums text-muted-foreground">
                  {c.start_date
                    ? new Date(c.start_date).toLocaleDateString("es-CR")
                    : "—"}
                </TableCell>
                <TableCell>
                  <ContractStatusBadge status={c.status as ContractStatus} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
