"use client"

import { useTranslations, useLocale } from "next-intl"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export interface OwnerSafeLeadRow {
  label:               string
  stage:               string
  interest_level:      string
  source:              string
  public_summary:      string | null
  appointment_at?:     string | null
  appointment_status?: string | null
  created_at:          string
}

interface Props {
  leads: OwnerSafeLeadRow[]
  /** Optional title shown above the table. */
  title?: string
  /** Optional privacy footnote. */
  privacyNote?: string
}

/**
 * Privacy-safe lead table for the owner report.
 *
 * NEVER renders raw names, phones, emails, or notes — those have
 * already been stripped at the SQL/aggregation layer. This component
 * just displays what it receives and refuses to invent anything.
 */
export function OwnerSafeLeadTable({ leads, title, privacyNote }: Props) {
  const tStage    = useTranslations("leads.stages")
  const locale    = useLocale()
  const dateLocale = locale === "es" ? "es-CR" : "en-US"

  if (leads.length === 0) return null

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(dateLocale, {
      day: "2-digit", month: "short", year: "numeric",
    })

  return (
    <section className="space-y-3">
      {title && (
        <h2 className="text-base font-heading font-semibold">{title}</h2>
      )}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden md:table-cell">Interés</TableHead>
              <TableHead className="hidden md:table-cell">Resumen</TableHead>
              <TableHead className="text-right">Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((l, i) => (
              <TableRow key={`${l.label}-${i}`}>
                <TableCell className="font-medium text-sm">{l.label}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {tStageOrFallback(tStage, l.stage)}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge
                    variant={l.interest_level === "high" ? "default" : "secondary"}
                    className="text-[10px] uppercase tracking-wide"
                  >
                    {l.interest_level}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[280px] truncate">
                  {l.public_summary ?? "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground font-numeric tabular-nums text-right whitespace-nowrap">
                  {fmtDate(l.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      {privacyNote && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">{privacyNote}</p>
      )}
    </section>
  )
}

// Translate a stage value safely — fall back to the raw value if it
// isn't in the known enum (defensive against future enum extensions).
function tStageOrFallback(t: (k: string) => string, stage: string): string {
  try { return t(stage) } catch { return stage }
}
