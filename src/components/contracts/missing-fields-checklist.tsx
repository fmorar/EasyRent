"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline"
import type { MissingField } from "@/types/contracts"

interface Props {
  missing:  MissingField[]
  onFocus?: (path: string) => void
}

const SECTION_LABEL: Record<MissingField["section"], string> = {
  landlord: "Arrendante",
  tenant:   "Arrendatario",
  property: "Propiedad",
  terms:    "Plazo",
  payments: "Pagos",
}

/** Compact checklist of required fields the user still has to fill. */
export function MissingFieldsChecklist({ missing, onFocus }: Props) {
  if (missing.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-success shrink-0" aria-hidden />
          <p className="text-sm">
            Todos los campos requeridos están completos.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Group by section for readability.
  const grouped = missing.reduce<Record<string, MissingField[]>>((acc, f) => {
    (acc[f.section] ??= []).push(f)
    return acc
  }, {})

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ExclamationTriangleIcon className="h-4 w-4 text-warning" />
          <p className="text-sm font-medium">Faltan campos requeridos</p>
          <Badge variant="secondary" className="ml-auto font-numeric tabular-nums">
            {missing.length}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Completá estos campos en la pestaña <strong>Datos</strong> antes de finalizar el contrato.
        </p>
        <ul className="space-y-2 pt-1">
          {Object.entries(grouped).map(([section, fields]) => (
            <li key={section} className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {SECTION_LABEL[section as MissingField["section"]]}
              </p>
              <ul className="space-y-1">
                {fields.map((f) => (
                  <li key={f.path}>
                    <button
                      type="button"
                      onClick={() => onFocus?.(f.path)}
                      className="flex items-center gap-2 text-sm w-full text-left hover:bg-muted/40 rounded px-2 py-1 transition-colors"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-warning shrink-0" aria-hidden />
                      <span>{f.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
