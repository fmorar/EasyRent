import { Alert } from "@/components/ui/alert"
import { ShieldCheckIcon } from "@heroicons/react/24/outline"

/**
 * Mandated disclaimer text per the spec — visible on every page that
 * generates or edits a contract draft. Copy is verbatim from the
 * spec to satisfy the legal requirement.
 */
export function LegalDisclaimerBanner() {
  return (
    <Alert className="border-warning/30 bg-warning-soft">
      <div className="flex items-start gap-3">
        <ShieldCheckIcon className="h-4 w-4 text-warning mt-0.5 shrink-0" />
        <p className="text-xs leading-relaxed text-foreground">
          Este sistema genera un borrador de contrato con base en la información
          ingresada y una plantilla predefinida. Antes de firmar, se recomienda
          que el documento sea revisado por un abogado o notario autorizado.
        </p>
      </div>
    </Alert>
  )
}
