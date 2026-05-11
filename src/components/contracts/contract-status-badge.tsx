import { Badge } from "@/components/ui/badge"
import type { ContractStatus } from "@/types"

const STYLE: Record<ContractStatus, string> = {
  draft:            "bg-muted text-muted-foreground",
  ready_for_review: "bg-warning-soft text-warning ring-warning/30",
  finalized:        "bg-success-soft text-success ring-success/30",
  signed:           "bg-info-soft text-info ring-info/30",
  archived:         "bg-muted/40 text-muted-foreground",
  // Legacy values (sale demo) we don't surface in the rental flow but
  // the type union still includes them.
  sent:             "bg-muted text-muted-foreground",
  voided:           "bg-destructive-soft text-destructive ring-destructive/30",
}

const LABEL: Record<ContractStatus, string> = {
  draft:            "Borrador",
  ready_for_review: "En revisión",
  finalized:        "Finalizado",
  signed:           "Firmado",
  archived:         "Archivado",
  sent:             "Enviado",
  voided:           "Anulado",
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return (
    <Badge variant="outline" className={`${STYLE[status]} ring-1 capitalize`}>
      {LABEL[status]}
    </Badge>
  )
}
