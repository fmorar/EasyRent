"use client"

import { useId, useState, useTransition } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SparklesIcon } from "@heroicons/react/24/outline"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  CIVIL_STATUSES,
  ID_TYPES,
  PETS_POLICIES,
  PAYMENT_METHODS,
  RENT_CURRENCIES,
  type ContractData,
} from "@/types/contracts"
import { integerToSpanishWords } from "@/lib/contracts/number-to-words-service"

interface Props {
  value:    ContractData
  onChange: (next: ContractData) => void
  disabled?: boolean
  /** When provided, the property description field shows a "Generar
   *  con IA" button that hits this contract's generate-description
   *  endpoint. */
  contractId?: string
}

/**
 * Single component holding every structured field of `ContractData`,
 * grouped by 5 sections. Kept inline rather than split into 5 files
 * so the wiring is colocated and the wizard's data-flow is obvious.
 *
 * Pattern: each input mutates a shallow copy of the section it
 * belongs to and calls `onChange` with the new full data tree. The
 * parent owns state — this component is fully controlled.
 */
export function ContractDataForm({ value, onChange, disabled, contractId }: Props) {
  function patchLandlord(p: Partial<ContractData["landlord"]>) {
    onChange({ ...value, landlord: { ...value.landlord, ...p } })
  }
  function patchTenant(p: Partial<ContractData["tenant"]>) {
    onChange({ ...value, tenant: { ...value.tenant, ...p } })
  }

  /**
   * Property patch with auto-derivations: when the user types a new
   * folio_real (or parking_folio_real), the spelled-out word version
   * is regenerated from the integer. This keeps the legal copy in
   * sync without forcing the user to type the same number twice.
   */
  function patchProperty(p: Partial<ContractData["property"]>) {
    const next = { ...value.property, ...p }
    if (p.folio_real !== undefined) {
      next.folio_real_words = numericToWordsOrEmpty(p.folio_real)
    }
    if (p.parking_folio_real !== undefined) {
      next.parking_folio_real_words = numericToWordsOrEmpty(p.parking_folio_real)
    }
    onChange({ ...value, property: next })
  }

  /**
   * Terms patch with auto-derivations: when start_date or term_months
   * changes AND the user hasn't manually fixed end_date, recompute
   * end_date as start_date + term_months. Pure date math.
   */
  function patchTerms(p: Partial<ContractData["terms"]>) {
    const next = { ...value.terms, ...p }
    const startChanged = p.start_date !== undefined
    const monthsChanged = p.term_months !== undefined
    if ((startChanged || monthsChanged) && next.start_date && next.term_months > 0) {
      const computed = addMonthsIso(next.start_date, next.term_months)
      // Only overwrite when the user is actively driving the change
      // (changing start_date or term_months) so manual end_date edits
      // aren't clobbered.
      if (computed) next.end_date = computed
    }
    onChange({ ...value, terms: next })
  }

  function patchPayments(p: Partial<ContractData["payments"]>) {
    onChange({ ...value, payments: { ...value.payments, ...p } })
  }
  function patchDelivery(p: Partial<ContractData["delivery"]>) {
    onChange({ ...value, delivery: { ...value.delivery, ...p } })
  }
  function patchRules(p: Partial<ContractData["rules"]>) {
    onChange({ ...value, rules: { ...value.rules, ...p } })
  }
  function patchContract(p: Partial<ContractData["contract"]>) {
    onChange({ ...value, contract: { ...value.contract, ...p } })
  }

  const fid = useId()
  const [aiPending, startAi] = useTransition()
  const [aiNote, setAiNote]  = useState<string>("")

  function generateDescription() {
    if (!contractId) return
    startAi(async () => {
      const res = await fetch(`/api/contracts/${contractId}/generate-description`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contract_data: value }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(j?.error ?? "No se pudo generar la descripción.")
        return
      }
      const { description } = await res.json()
      patchProperty({ description })
      setAiNote("Descripción generada con IA. Revisala antes de finalizar.")
      toast.success("Descripción generada.")
    })
  }

  return (
    <fieldset disabled={disabled} className="space-y-(--spacing-section)">
      {/* ── Section 1 · Arrendante ──────────────────────────── */}
      <Section
        id="landlord"
        title="Arrendante (propietario)"
        description="Datos del propietario que firma el contrato. Se reusan los datos legales de contratos anteriores del mismo dueño."
      >
        <Grid>
          <Field label="Nombre completo" required>
            <Input
              value={value.landlord.full_name}
              onChange={(e) => patchLandlord({ full_name: e.target.value })}
            />
          </Field>
          <Field label="Tipo de documento">
            <Select value={value.landlord.id_type} onValueChange={(v) => patchLandlord({ id_type: v as ContractData["landlord"]["id_type"] })}>
              <SelectTrigger>
                <SelectValue>
                  {(v: unknown) => ID_LABEL[v as keyof typeof ID_LABEL] ?? ""}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ID_TYPES.map((t) => <SelectItem key={t} value={t}>{ID_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Número de documento" required>
            <Input
              value={value.landlord.id_number}
              onChange={(e) => patchLandlord({ id_number: e.target.value })}
            />
          </Field>
          <Field label="Estado civil">
            <Select value={value.landlord.civil_status || undefined} onValueChange={(v) => patchLandlord({ civil_status: v ?? "" })}>
              <SelectTrigger>
                <SelectValue placeholder="Sin definir">
                  {(v: unknown) => v ? (CIVIL_LABEL[v as keyof typeof CIVIL_LABEL] ?? "") : ""}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CIVIL_STATUSES.map((s) => <SelectItem key={s} value={s}>{CIVIL_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Profesión">
            <Input
              value={value.landlord.profession}
              onChange={(e) => patchLandlord({ profession: e.target.value })}
            />
          </Field>
          <Field label="Domicilio">
            <Input
              value={value.landlord.domicile}
              onChange={(e) => patchLandlord({ domicile: e.target.value })}
            />
          </Field>
          <Field label="Correo electrónico" required>
            <Input
              type="email"
              value={value.landlord.email}
              onChange={(e) => patchLandlord({ email: e.target.value })}
            />
          </Field>
          <Field label="Teléfono">
            <Input
              value={value.landlord.phone}
              onChange={(e) => patchLandlord({ phone: e.target.value })}
            />
          </Field>
        </Grid>
        <Grid columns={1}>
          <Field label="Banco" required>
            <Input
              value={value.landlord.bank_name}
              onChange={(e) => patchLandlord({ bank_name: e.target.value })}
              placeholder="Ej: BAC Credomatic"
            />
          </Field>
          <Field label="IBAN" required helper="Cuenta donde el inquilino transfiere el alquiler.">
            <Input
              value={value.landlord.iban}
              onChange={(e) => patchLandlord({ iban: e.target.value })}
              placeholder="CR12 3456 7890 1234 5678"
              className="font-numeric tabular-nums"
            />
          </Field>
          <Field label="Correo para recibir comprobantes" required>
            <Input
              type="email"
              value={value.landlord.payment_confirmation_email}
              onChange={(e) => patchLandlord({ payment_confirmation_email: e.target.value })}
            />
          </Field>
        </Grid>
      </Section>

      {/* ── Section 2 · Arrendatario ────────────────────────── */}
      <Section
        id="tenant"
        title="Arrendatario (inquilino)"
        description="Datos del inquilino tomados del lead seleccionado, complementables manualmente."
      >
        <Grid>
          <Field label="Nombre completo" required>
            <Input
              value={value.tenant.full_name}
              onChange={(e) => patchTenant({ full_name: e.target.value })}
            />
          </Field>
          <Field label="Tipo de documento">
            <Select value={value.tenant.id_type} onValueChange={(v) => patchTenant({ id_type: v as ContractData["tenant"]["id_type"] })}>
              <SelectTrigger>
                <SelectValue>
                  {(v: unknown) => ID_LABEL[v as keyof typeof ID_LABEL] ?? ""}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ID_TYPES.map((t) => <SelectItem key={t} value={t}>{ID_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Número de documento" required>
            <Input
              value={value.tenant.id_number}
              onChange={(e) => patchTenant({ id_number: e.target.value })}
            />
          </Field>
          {value.tenant.id_type === "passport" && (
            <>
              <Field label="País emisor del pasaporte" required>
                <Input
                  value={value.tenant.passport_country}
                  onChange={(e) => patchTenant({ passport_country: e.target.value })}
                />
              </Field>
              <Field label="Nacionalidad" required>
                <Input
                  value={value.tenant.nationality}
                  onChange={(e) => patchTenant({ nationality: e.target.value })}
                />
              </Field>
            </>
          )}
          <Field label="Estado civil">
            <Select value={value.tenant.civil_status || undefined} onValueChange={(v) => patchTenant({ civil_status: v ?? "" })}>
              <SelectTrigger>
                <SelectValue placeholder="Sin definir">
                  {(v: unknown) => v ? (CIVIL_LABEL[v as keyof typeof CIVIL_LABEL] ?? "") : ""}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CIVIL_STATUSES.map((s) => <SelectItem key={s} value={s}>{CIVIL_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Profesión">
            <Input
              value={value.tenant.profession}
              onChange={(e) => patchTenant({ profession: e.target.value })}
            />
          </Field>
          <Field label="Domicilio">
            <Input
              value={value.tenant.domicile}
              onChange={(e) => patchTenant({ domicile: e.target.value })}
            />
          </Field>
          <Field label="Correo">
            <Input
              type="email"
              value={value.tenant.email}
              onChange={(e) => patchTenant({ email: e.target.value })}
            />
          </Field>
          <Field label="Teléfono">
            <Input
              value={value.tenant.phone}
              onChange={(e) => patchTenant({ phone: e.target.value })}
            />
          </Field>
        </Grid>
      </Section>

      {/* ── Section 3 · Propiedad / detalles legales ────────── */}
      <Section
        id="property"
        title="Detalles legales de la propiedad"
        description="Folio real, condominio y ubicación precargados de los datos de la propiedad."
      >
        <Grid>
          <Field label="Nombre del condominio">
            <Input
              value={value.property.condominium_name}
              onChange={(e) => patchProperty({ condominium_name: e.target.value })}
            />
          </Field>
          <Field label="Número de unidad / apartamento" required>
            <Input
              value={value.property.unit_number}
              onChange={(e) => patchProperty({ unit_number: e.target.value })}
            />
          </Field>
          <Field label="Folio real" required>
            <Input
              value={value.property.folio_real}
              onChange={(e) => patchProperty({ folio_real: e.target.value })}
              className="font-numeric tabular-nums"
            />
          </Field>
          <Field label="Folio real en palabras">
            <Input
              value={value.property.folio_real_words}
              onChange={(e) => patchProperty({ folio_real_words: e.target.value })}
              placeholder="Ej: TRESCIENTOS QUINCE MIL DOS"
            />
          </Field>
          <Field label="Folio real del parqueo">
            <Input
              value={value.property.parking_folio_real}
              onChange={(e) => patchProperty({ parking_folio_real: e.target.value })}
              className="font-numeric tabular-nums"
            />
          </Field>
          <Field label="Folio del parqueo en palabras">
            <Input
              value={value.property.parking_folio_real_words}
              onChange={(e) => patchProperty({ parking_folio_real_words: e.target.value })}
            />
          </Field>
          <Field label="Provincia">
            <Input
              value={value.property.province}
              onChange={(e) => patchProperty({ province: e.target.value })}
            />
          </Field>
          <Field label="Cantón">
            <Input
              value={value.property.canton}
              onChange={(e) => patchProperty({ canton: e.target.value })}
            />
          </Field>
          <Field label="Distrito">
            <Input
              value={value.property.district}
              onChange={(e) => patchProperty({ district: e.target.value })}
            />
          </Field>
          <Field label="Piso">
            <Input
              value={value.property.floor}
              onChange={(e) => patchProperty({ floor: e.target.value })}
            />
          </Field>
          <Field label="Piso del parqueo">
            <Input
              value={value.property.parking_floor}
              onChange={(e) => patchProperty({ parking_floor: e.target.value })}
            />
          </Field>
          <Field label="Habitaciones">
            <Input
              type="number" min={0}
              value={value.property.bedrooms}
              onChange={(e) => patchProperty({ bedrooms: Number(e.target.value) || 0 })}
              className="font-numeric tabular-nums"
            />
          </Field>
          <Field label="Baños">
            <Input
              type="number" min={0} step={0.5}
              value={value.property.bathrooms}
              onChange={(e) => patchProperty({ bathrooms: Number(e.target.value) || 0 })}
              className="font-numeric tabular-nums"
            />
          </Field>
          <Field label="Parqueos">
            <Input
              type="number" min={0}
              value={value.property.parking_spaces}
              onChange={(e) => patchProperty({ parking_spaces: Number(e.target.value) || 0 })}
              className="font-numeric tabular-nums"
            />
          </Field>
        </Grid>
        <Grid columns={1}>
          <Field
            label="Descripción del inmueble"
            helper={aiNote || "Detalle del mobiliario, acabados y elementos incluidos."}
          >
            <div className="space-y-2">
              <Textarea
                rows={5}
                value={value.property.description}
                onChange={(e) => patchProperty({ description: e.target.value })}
                className="resize-y min-h-[120px]"
              />
              {contractId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateDescription}
                  disabled={aiPending || disabled}
                  className="text-luxe border-luxe/30 hover:bg-luxe/5 hover:text-luxe"
                >
                  <SparklesIcon className={`h-3.5 w-3.5 ${aiPending ? "animate-pulse" : ""}`} />
                  {aiPending ? "Generando…" : "Generar con IA"}
                </Button>
              )}
            </div>
          </Field>
        </Grid>
      </Section>

      {/* ── Section 4 · Plazo ──────────────────────────────── */}
      <Section
        id="terms"
        title="Plazo del contrato"
        description="Fechas y términos de renovación. Las fechas se convierten automáticamente a palabras al guardar."
      >
        <Grid>
          <Field label="Fecha de inicio" required>
            <Input
              type="date"
              value={value.terms.start_date}
              onChange={(e) => patchTerms({ start_date: e.target.value })}
            />
          </Field>
          <Field label="Fecha de fin" required>
            <Input
              type="date"
              value={value.terms.end_date}
              onChange={(e) => patchTerms({ end_date: e.target.value })}
            />
          </Field>
          <Field label="Plazo (meses)">
            <Input
              type="number" min={1}
              value={value.terms.term_months}
              onChange={(e) => patchTerms({ term_months: Number(e.target.value) || 12 })}
              className="font-numeric tabular-nums"
            />
          </Field>
          <Field label="Aviso previo para terminar (meses)">
            <Input
              type="number" min={1}
              value={value.terms.early_termination_notice_months}
              onChange={(e) => patchTerms({ early_termination_notice_months: Number(e.target.value) || 3 })}
              className="font-numeric tabular-nums"
            />
          </Field>
          <Field label="Renovación máxima (años)">
            <Input
              type="number" min={1}
              value={value.terms.max_renewal_years}
              onChange={(e) => patchTerms({ max_renewal_years: Number(e.target.value) || 3 })}
              className="font-numeric tabular-nums"
            />
          </Field>
        </Grid>
        <Grid columns={1}>
          <CheckboxRow
            id={`${fid}-auto-renewal`}
            label="Renovación automática al final del plazo"
            checked={value.terms.auto_renewal}
            onChange={(c) => patchTerms({ auto_renewal: c })}
          />
        </Grid>
      </Section>

      {/* ── Section 5 · Pagos ──────────────────────────────── */}
      <Section
        id="payments"
        title="Pagos y depósito"
        description="Monto, moneda, día de pago y método. Los importes se convierten a palabras automáticamente."
      >
        <Grid>
          <Field label="Monto del alquiler" required>
            <Input
              type="number" min={0} step={0.01}
              value={value.payments.rent_amount}
              onChange={(e) => patchPayments({ rent_amount: Number(e.target.value) || 0 })}
              className="font-numeric tabular-nums"
            />
          </Field>
          <Field label="Moneda del alquiler">
            <Select value={value.payments.rent_currency} onValueChange={(v) => patchPayments({ rent_currency: v as ContractData["payments"]["rent_currency"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RENT_CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Depósito" required>
            <Input
              type="number" min={0} step={0.01}
              value={value.payments.deposit_amount}
              onChange={(e) => patchPayments({ deposit_amount: Number(e.target.value) || 0 })}
              className="font-numeric tabular-nums"
            />
          </Field>
          <Field label="Moneda del depósito">
            <Select value={value.payments.deposit_currency} onValueChange={(v) => patchPayments({ deposit_currency: v as ContractData["payments"]["deposit_currency"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RENT_CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Día de pago">
            <Input
              type="number" min={1} max={31}
              value={value.payments.payment_due_day}
              onChange={(e) => patchPayments({ payment_due_day: Number(e.target.value) || 1 })}
              className="font-numeric tabular-nums"
            />
          </Field>
          <Field label="Día límite sin mora">
            <Input
              type="number" min={1} max={31}
              value={value.payments.last_payment_day_without_default}
              onChange={(e) => patchPayments({ last_payment_day_without_default: Number(e.target.value) || 4 })}
              className="font-numeric tabular-nums"
            />
          </Field>
          <Field label="Método de pago">
            <Select value={value.payments.payment_method} onValueChange={(v) => patchPayments({ payment_method: v as ContractData["payments"]["payment_method"] })}>
              <SelectTrigger>
                <SelectValue>
                  {(v: unknown) => PAYMENT_LABEL[v as keyof typeof PAYMENT_LABEL] ?? ""}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{PAYMENT_LABEL[m]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </Grid>
        <Grid columns={1}>
          <CheckboxRow
            id={`${fid}-maint`}
            label="El alquiler incluye la cuota de mantenimiento condominal"
            checked={value.payments.maintenance_included}
            onChange={(c) => patchPayments({ maintenance_included: c })}
          />
        </Grid>
      </Section>

      {/* ── Extra · Entrega + reglas ───────────────────────── */}
      <Section
        id="delivery"
        title="Entregas y reglas"
        description="Llaves, tarjetas, adhesivos y reglas del condominio."
      >
        <Grid>
          <Field label="Llaves entregadas">
            <Input
              type="number" min={0}
              value={value.delivery.keys_count}
              onChange={(e) => patchDelivery({ keys_count: Number(e.target.value) || 0 })}
              className="font-numeric tabular-nums"
            />
          </Field>
          <Field label="Tarjetas de acceso">
            <Input
              type="number" min={0}
              value={value.delivery.access_cards_count}
              onChange={(e) => patchDelivery({ access_cards_count: Number(e.target.value) || 0 })}
              className="font-numeric tabular-nums"
            />
          </Field>
          <Field label="Adhesivos vehiculares">
            <Input
              type="number" min={0}
              value={value.delivery.vehicle_stickers_count}
              onChange={(e) => patchDelivery({ vehicle_stickers_count: Number(e.target.value) || 0 })}
              className="font-numeric tabular-nums"
            />
          </Field>
          <Field label="Política de mascotas">
            <Select value={value.rules.pets_allowed} onValueChange={(v) => patchRules({ pets_allowed: v as ContractData["rules"]["pets_allowed"] })}>
              <SelectTrigger>
                <SelectValue>
                  {(v: unknown) => PETS_LABEL[v as keyof typeof PETS_LABEL] ?? ""}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PETS_POLICIES.map((p) => <SelectItem key={p} value={p}>{PETS_LABEL[p]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </Grid>
        <Grid columns={1}>
          <CheckboxRow
            id={`${fid}-rules-delivered`}
            label="Reglamento condominal entregado al inquilino"
            checked={value.rules.condominium_rules_delivered}
            onChange={(c) => patchRules({ condominium_rules_delivered: c })}
          />
          <CheckboxRow
            id={`${fid}-sublease`}
            label="Subarriendo permitido"
            checked={value.rules.sublease_allowed}
            onChange={(c) => patchRules({ sublease_allowed: c })}
          />
          <CheckboxRow
            id={`${fid}-commercial`}
            label="Uso comercial permitido"
            checked={value.rules.commercial_use_allowed}
            onChange={(c) => patchRules({ commercial_use_allowed: c })}
          />
        </Grid>
        <Grid columns={1}>
          <Field label="Ciudad de firma">
            <Input
              value={value.contract.city}
              onChange={(e) => patchContract({ city: e.target.value })}
            />
          </Field>
          <Field label="Fecha de firma">
            <Input
              type="date"
              value={value.contract.signing_date}
              onChange={(e) => patchContract({ signing_date: e.target.value })}
            />
          </Field>
        </Grid>
      </Section>
    </fieldset>
  )
}

// ── Sub-helpers ──────────────────────────────────────────────────

function Section({
  id, title, description, children,
}: {
  id:           string
  title:        string
  description:  string
  children:     React.ReactNode
}) {
  return (
    <Card id={id}>
      <CardContent className="p-4 sm:p-5 lg:p-6 space-y-(--spacing-block)">
        <header className="space-y-1">
          <h2 className="text-base font-heading font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </header>
        {children}
      </CardContent>
    </Card>
  )
}

function Grid({ children, columns = 2 }: { children: React.ReactNode; columns?: 1 | 2 }) {
  return (
    <div className={
      columns === 1
        ? "grid grid-cols-1 gap-(--spacing-cluster)"
        : "grid grid-cols-1 sm:grid-cols-2 gap-(--spacing-cluster)"
    }>
      {children}
    </div>
  )
}

function Field({
  label, required, helper, children,
}: {
  label:      string
  required?:  boolean
  helper?:    string
  children:   React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {helper && <p className="text-[11px] text-muted-foreground/80 leading-relaxed">{helper}</p>}
    </div>
  )
}

function CheckboxRow({
  id, label, checked, onChange,
}: {
  id:       string
  label:    string
  checked:  boolean
  onChange: (c: boolean) => void
}) {
  return (
    <Label
      htmlFor={id}
      className="flex items-center gap-3 rounded-md border bg-card px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(Boolean(v))}
      />
      <span className="text-sm font-normal">{label}</span>
    </Label>
  )
}

// ── Static label maps (keeps the JSX above readable) ────────────

const ID_LABEL: Record<typeof ID_TYPES[number], string> = {
  cedula:   "Cédula",
  passport: "Pasaporte",
  dimex:    "DIMEX",
  other:    "Otro",
}

const CIVIL_LABEL: Record<typeof CIVIL_STATUSES[number], string> = {
  soltero:        "Soltero",
  soltera:        "Soltera",
  casado:         "Casado",
  casada:         "Casada",
  divorciado:     "Divorciado",
  divorciada:     "Divorciada",
  viudo:          "Viudo",
  viuda:          "Viuda",
  union_de_hecho: "Unión de hecho",
  otro:           "Otro",
}

const PETS_LABEL: Record<typeof PETS_POLICIES[number], string> = {
  not_allowed:               "No se permiten",
  requires_written_approval: "Requiere autorización escrita",
  allowed:                   "Permitidas",
}

const PAYMENT_LABEL: Record<typeof PAYMENT_METHODS[number], string> = {
  bank_transfer: "Transferencia bancaria",
  cash:          "Efectivo",
  check:         "Cheque",
  other:         "Otro",
}

// ── Auto-derivation helpers ─────────────────────────────────────

/**
 * Convert a folio-real-style numeric string into Spanish words. The
 * folio is typically all digits — `unoToUn` handles the trailing
 * "uno → un" the legal phrasing prefers. Falls back to empty when
 * the input doesn't look like a number (the user may type letters
 * for non-standard registries).
 */
function numericToWordsOrEmpty(raw: string): string {
  const cleaned = raw.replace(/[^\d]/g, "")
  if (cleaned.length === 0) return ""
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0 || n >= 1_000_000_000_000) return ""
  try {
    return integerToSpanishWords(n).toUpperCase()
  } catch {
    return ""
  }
}

/**
 * Add `months` calendar months to an ISO `yyyy-mm-dd` string and
 * return the result in the same format. Returns null if the input
 * date is malformed. UTC-stable (avoids timezone drift on the date
 * boundary).
 */
function addMonthsIso(iso: string, months: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  const y = +m[1], mo = +m[2], d = +m[3]
  const date = new Date(Date.UTC(y, mo - 1, d))
  date.setUTCMonth(date.getUTCMonth() + months)
  // If the original day was, say, the 31st and the target month has
  // fewer days, JS rolls over (e.g. Feb 31 → Mar 3). Clamp by
  // detecting overflow and walking back to the last day of the
  // intended month.
  if (date.getUTCDate() !== d) {
    date.setUTCDate(0)
  }
  const yy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(date.getUTCDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}
