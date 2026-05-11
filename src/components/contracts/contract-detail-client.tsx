"use client"

import { useCallback, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ClipboardDocumentCheckIcon,
} from "@heroicons/react/24/outline"
import { ContractEditor } from "./contract-editor"
import { ContractDataForm } from "./contract-data-form"
import { ContractStatusBadge } from "./contract-status-badge"
import { MissingFieldsChecklist } from "./missing-fields-checklist"
import { TemplateHealthWarnings } from "./template-health-warnings"
import { ContractExportButtons } from "./contract-export-buttons"
import { LegalDisclaimerBanner } from "./legal-disclaimer-banner"
import { formatPrice } from "@/lib/utils"
import {
  ContractDataSchema,
  type ContractData,
  type HealthWarning,
  type MissingField,
} from "@/types/contracts"
import { generateContractDraft } from "@/lib/contracts/contract-generation-service"
import type { Contract, ContractStatus } from "@/types"

interface Props {
  contract:       Contract
  initialData:    ContractData
  initialHtml:    string
  /** Raw template HTML — passed so the client can recompute warnings
   *  on every edit without round-tripping the server. The generation
   *  service is pure JS, no node-only deps; safe in the bundle. */
  templateHtml:   string
  warnings:       HealthWarning[]
  missingFields:  MissingField[]
  property?: { id: string; title: string; display_address: string | null } | null
  tenant?:   { id: string; full_name: string; email: string | null; phone: string | null } | null
  owner?:    { id: string; full_name: string; email: string | null } | null
}

/**
 * Detail page orchestrator. Owns the local state for the structured
 * data + editor HTML, talks to the API for save / regenerate /
 * finalize / export.
 *
 * Tabs:
 *   • Datos    — `<ContractDataForm>` (the 5 sections inline)
 *   • Borrador — `<ContractEditor>` (Tiptap, manually editable)
 *   • Vista previa — read-only Tiptap (renders the saved HTML)
 *
 * Save model: structured data + HTML save independently. The
 * "Regenerar borrador" action overwrites the HTML from the data —
 * we warn about manual edits with a confirm dialog.
 */
export function ContractDetailClient({
  contract,
  initialData,
  initialHtml,
  templateHtml,
  warnings,
  missingFields,
  property,
  tenant,
  owner,
}: Props) {
  const router = useRouter()

  const [data, setData] = useState<ContractData>(initialData)
  const [html, setHtml] = useState<string>(initialHtml)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Live recompute: as the user edits the structured data, run the
  // full generation pipeline locally to refresh warnings + missing
  // fields. Pure JS — placeholder/health-check/validation services
  // have no Node-only deps. Memoised so it only runs when `data` or
  // `templateHtml` change.
  const live = useMemo(() => {
    if (!templateHtml) return null
    try {
      return generateContractDraft({
        template_html: templateHtml,
        contract_data: data,
      })
    } catch {
      return null
    }
  }, [data, templateHtml])

  // Use live values when available; fall back to the server-rendered
  // initial values (covers the brief moment before the first memo
  // run, or any edge case where generation throws).
  const warns:   HealthWarning[] = live?.warnings       ?? warnings
  const missing: MissingField[]  = live?.missing_fields ?? missingFields

  const [savingData,    sd] = useTransition()
  const [savingHtml,    sh] = useTransition()
  const [regenerating,  sr] = useTransition()
  const [finalizing,    sf] = useTransition()
  const [savingVersion, sv] = useTransition()

  const status = contract.status as ContractStatus
  const finalized = status === "finalized" || status === "signed"
  const canFinalize = missing.length === 0 &&
                      warns.filter((w) => w.severity === "high").length === 0

  // ── Save the structured data without regenerating HTML ──
  const onSaveData = useCallback(() => {
    sd(async () => {
      const res = await fetch(`/api/contracts/${contract.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ contract_data: data }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(j?.error ?? "No se pudo guardar.")
        return
      }
      toast.success("Datos guardados.")
      router.refresh()
    })
  }, [contract.id, data, router])

  // ── Save the editor HTML (manual edits) ─────────────────
  const onSaveHtml = useCallback(() => {
    sh(async () => {
      const res = await fetch(`/api/contracts/${contract.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ editor_content_html: html }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(j?.error ?? "No se pudo guardar.")
        return
      }
      toast.success("Borrador guardado.")
      router.refresh()
    })
  }, [contract.id, html, router])

  // ── Regenerate HTML from structured data (destructive) ──
  const onRegenerate = useCallback(() => {
    sr(async () => {
      // Always save current data first so the regen reads the latest.
      const saveRes = await fetch(`/api/contracts/${contract.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ contract_data: data, regenerate: true }),
      })
      if (!saveRes.ok) {
        const j = await saveRes.json().catch(() => ({}))
        toast.error(j?.error ?? "No se pudo regenerar el borrador.")
        return
      }
      // Re-fetch to get the regenerated HTML. Warnings + missing
      // fields are derived locally from `data` via the `live` memo,
      // so we don't need to thread them through state.
      const detail = await fetch(`/api/contracts/${contract.id}`).then((r) => r.json())
      setHtml(detail.contract.editor_content_html ?? "")
      const parsed = ContractDataSchema.safeParse(detail.contract.contract_data)
      if (parsed.success) setData(parsed.data)
      toast.success("Borrador regenerado desde los datos estructurados.")
      router.refresh()
    })
  }, [contract.id, data, router])

  // ── Save the current state as a new version ─────────────
  const onSaveVersion = useCallback(() => {
    sv(async () => {
      const res = await fetch(`/api/contracts/${contract.id}/save-version`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ change_summary: "Snapshot manual" }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(j?.error ?? "No se pudo guardar la versión.")
        return
      }
      const { version_number } = await res.json()
      toast.success(`Versión ${version_number} guardada.`)
    })
  }, [contract.id])

  // ── Finalize ────────────────────────────────────────────
  const onFinalize = useCallback(() => {
    sf(async () => {
      const res = await fetch(`/api/contracts/${contract.id}/finalize`, { method: "POST" })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(j?.error ?? "No se pudo finalizar.")
        return
      }
      toast.success("Contrato finalizado.")
      router.refresh()
    })
  }, [contract.id, router])

  // ── Render ──────────────────────────────────────────────
  return (
    <div className="space-y-(--spacing-section) py-(--spacing-cluster)">
      {/* Header */}
      <header className="flex flex-col gap-(--spacing-tight) sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-(--spacing-tight) min-w-0 flex-1">
          <Link
            href="/contracts"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            Volver al listado
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-heading font-bold tracking-tight min-w-0 truncate">
              {contract.title ?? "Contrato"}
            </h1>
            <ContractStatusBadge status={status} />
          </div>
          {property?.display_address && (
            <p className="text-sm text-muted-foreground">{property.display_address}</p>
          )}
        </div>
      </header>

      <LegalDisclaimerBanner />

      {/* Summary stats */}
      <Card>
        <CardContent className="p-0 grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border">
          <Stat label="Propiedad" value={property?.title ?? "—"} />
          <Stat label="Inquilino" value={tenant?.full_name ?? "—"} />
          <Stat
            label="Alquiler"
            value={data.payments.rent_amount > 0
              ? formatPrice(data.payments.rent_amount, data.payments.rent_currency)
              : "—"}
          />
          <Stat
            label="Inicio"
            value={data.terms.start_date
              ? new Date(data.terms.start_date).toLocaleDateString("es-CR")
              : "—"}
          />
        </CardContent>
      </Card>

      {/* Two-column layout: editor/forms left, sidebars right */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)] gap-(--spacing-section)">
        {/* Main column */}
        <div className="space-y-(--spacing-block) min-w-0">
          <Tabs defaultValue="data">
            <TabsList>
              <TabsTrigger value="data">Datos</TabsTrigger>
              <TabsTrigger value="editor">Borrador</TabsTrigger>
              <TabsTrigger value="preview">Vista previa</TabsTrigger>
            </TabsList>
            <TabsContent value="data" className="space-y-(--spacing-block)">
              <ContractDataForm
                value={data}
                onChange={setData}
                disabled={finalized}
                contractId={contract.id}
              />
              {!finalized && (
                <div className="flex flex-wrap gap-(--spacing-tight) sticky bottom-3 bg-background/80 backdrop-blur rounded-lg p-(--spacing-tight) border shadow-sm">
                  <Button onClick={onSaveData} disabled={savingData}>
                    {savingData ? "Guardando…" : "Guardar datos"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmOpen(true)}
                    disabled={regenerating}
                  >
                    <ArrowPathIcon className="h-4 w-4" />
                    {regenerating ? "Regenerando…" : "Regenerar borrador"}
                  </Button>
                </div>
              )}
            </TabsContent>
            <TabsContent value="editor" className="space-y-(--spacing-cluster)">
              <ContractEditor value={html} onChange={setHtml} readOnly={finalized} />
              {!finalized && (
                <div className="flex flex-wrap gap-(--spacing-tight)">
                  <Button onClick={onSaveHtml} disabled={savingHtml}>
                    {savingHtml ? "Guardando…" : "Guardar borrador"}
                  </Button>
                  <Button variant="outline" onClick={onSaveVersion} disabled={savingVersion}>
                    {savingVersion ? "Guardando…" : "Guardar versión"}
                  </Button>
                </div>
              )}
            </TabsContent>
            <TabsContent value="preview">
              <ContractEditor value={html} onChange={() => undefined} readOnly />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right rail */}
        <aside className="space-y-(--spacing-block) lg:sticky lg:top-20 lg:self-start">
          <MissingFieldsChecklist
            missing={missing}
            onFocus={(path) => {
              const section = path.split(".")[0]
              const el = document.getElementById(section)
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
            }}
          />
          <TemplateHealthWarnings warnings={warns} />

          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium">Acciones</p>
              <Button
                onClick={onFinalize}
                disabled={finalizing || finalized || !canFinalize}
                className="w-full"
              >
                <ClipboardDocumentCheckIcon className="h-4 w-4" />
                {finalized
                  ? "Contrato finalizado"
                  : finalizing
                    ? "Finalizando…"
                    : "Finalizar contrato"}
              </Button>
              {!canFinalize && !finalized && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Resolvé las alertas críticas y completá los campos requeridos antes de finalizar.
                </p>
              )}
              {finalized && (
                <div className="flex items-center gap-2 text-xs text-success">
                  <CheckCircleIcon className="h-4 w-4" />
                  Listo para descargar
                </div>
              )}
              <ContractExportButtons contractId={contract.id} disabled={!html} />
              {owner && (
                <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
                  Arrendante: <strong className="font-medium text-foreground">{owner.full_name}</strong>
                  {owner.email && <> · {owner.email}</>}
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Confirm dialog for regenerate */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Regenerar borrador</DialogTitle>
            <DialogDescription className="text-xs">
              Se sobrescribirá el HTML del editor con un borrador fresco basado en los datos estructurados.
              Si tenías ediciones manuales, se perderán. Recomendamos guardar una versión antes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmOpen(false)
                onSaveVersion()
              }}
            >
              Guardar versión y regenerar
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false)
                onRegenerate()
              }}
            >
              Regenerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 sm:px-5 sm:py-4 min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium truncate mt-1">{value}</p>
    </div>
  )
}
