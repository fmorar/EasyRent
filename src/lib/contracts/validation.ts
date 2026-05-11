// ============================================================
// Required-fields gate before a contract can transition out of
// draft. Pure, sync. Operates on `ContractData` only — separate
// from the health-check service (which scans the rendered HTML).
//
// A contract can ALWAYS be saved as draft (the user comes and goes).
// What this gate enforces is the move from `draft` →
// `ready_for_review` / `finalized`.
// ============================================================

import type { ContractData, MissingField } from "@/types/contracts"

interface FieldRule {
  path:    string
  label:   string
  section: MissingField["section"]
  /** Optional predicate — when true, the field is required. Defaults
   *  to "always required". Used for fields that are conditional
   *  (e.g. tenant.passport_country only when id_type === passport). */
  required_if?: (d: ContractData) => boolean
}

const REQUIRED_FIELDS: readonly FieldRule[] = [
  // Landlord PII — every legal contract needs these.
  { path: "landlord.full_name", label: "Nombre del arrendante",        section: "landlord" },
  { path: "landlord.id_number", label: "Cédula del arrendante",        section: "landlord" },
  { path: "landlord.email",     label: "Correo del arrendante",        section: "landlord" },

  // Tenant PII.
  { path: "tenant.full_name",        label: "Nombre del arrendatario",   section: "tenant" },
  { path: "tenant.id_number",        label: "Documento del arrendatario", section: "tenant" },
  {
    path:        "tenant.passport_country",
    label:       "País emisor del pasaporte",
    section:     "tenant",
    required_if: (d) => d.tenant.id_type === "passport",
  },
  {
    path:        "tenant.nationality",
    label:       "Nacionalidad del arrendatario",
    section:     "tenant",
    required_if: (d) => d.tenant.id_type === "passport",
  },

  // Property — folio_real is the legal anchor.
  { path: "property.unit_number",   label: "Número de unidad / apartamento", section: "property" },
  { path: "property.folio_real",    label: "Folio real",                     section: "property" },
  {
    path:        "property.condominium_name",
    label:       "Nombre del condominio",
    section:     "property",
    // Only require when the unit number suggests a condo numbering
    // scheme; for stand-alone houses this is optional.
    required_if: (d) => d.property.unit_number.trim().length > 0,
  },

  // Terms.
  { path: "terms.start_date", label: "Fecha de inicio", section: "terms" },
  { path: "terms.end_date",   label: "Fecha de fin",    section: "terms" },

  // Payments.
  { path: "payments.rent_amount",    label: "Monto de alquiler", section: "payments" },
  { path: "payments.deposit_amount", label: "Depósito",          section: "payments" },

  // Banking — required when payment_method is bank_transfer (which is
  // our default).
  {
    path:        "landlord.bank_name",
    label:       "Banco del arrendante",
    section:     "landlord",
    required_if: (d) => d.payments.payment_method === "bank_transfer",
  },
  {
    path:        "landlord.iban",
    label:       "IBAN del arrendante",
    section:     "landlord",
    required_if: (d) => d.payments.payment_method === "bank_transfer",
  },
  {
    path:        "landlord.payment_confirmation_email",
    label:       "Correo para notificar comprobantes",
    section:     "landlord",
    required_if: (d) => d.payments.payment_method === "bank_transfer",
  },
] as const

/** Walk a dotted path and return the leaf value. */
function lookup(d: ContractData, path: string): unknown {
  const parts = path.split(".")
  let cur: unknown = d
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

/** Treat empty strings, NaN, 0, and undefined/null as "missing". */
function isMissing(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === "string") return value.trim().length === 0
  if (typeof value === "number") return Number.isNaN(value) || value === 0
  return false
}

/** Compute the list of required fields the contract is still missing. */
export function findMissingFields(data: ContractData): MissingField[] {
  const out: MissingField[] = []
  for (const rule of REQUIRED_FIELDS) {
    if (rule.required_if && !rule.required_if(data)) continue
    if (isMissing(lookup(data, rule.path))) {
      out.push({ path: rule.path, label: rule.label, section: rule.section })
    }
  }
  return out
}

interface FinalizeCheckResult {
  ok:             boolean
  missing_fields: MissingField[]
  /** Reasons unrelated to required fields (e.g. unresolved placeholders
   *  in the rendered HTML). The caller is expected to populate this
   *  by combining with the placeholder service result. */
  blockers:       string[]
}

interface FinalizeInput {
  data:                ContractData
  unresolved_count?:   number
}

/** Decide whether a draft can transition to `ready_for_review` or
 *  `finalized`. Returns the missing fields plus any structural
 *  blockers the caller passed in. */
export function canFinalize(input: FinalizeInput): FinalizeCheckResult {
  const missing  = findMissingFields(input.data)
  const blockers: string[] = []
  if (missing.length > 0) {
    blockers.push(`${missing.length} campos requeridos sin completar`)
  }
  if (input.unresolved_count && input.unresolved_count > 0) {
    blockers.push(`${input.unresolved_count} placeholders sin resolver en el contrato`)
  }
  return { ok: blockers.length === 0, missing_fields: missing, blockers }
}
