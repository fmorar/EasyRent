// ============================================================
// Prefill service — assembles a `ContractData` payload from the
// existing property + owner + lead + project + most-recent-contract
// records.
//
// Scope:
//   • Reads only. No writes. No mutation of the source rows.
//   • Returns a fully-defaulted ContractData even when sources have
//     gaps. Empty strings flag the missing-fields checklist.
//   • Pulls landlord legal PII (civil_status, profession, domicile,
//     bank_name, iban, payment_confirmation_email) from the most
//     recent prior contract of the SAME owner. The owner doesn't
//     have to retype these every time.
//
// Contract:
//   prefillContractData({ property_id, lead_id, supabase })
//     → { contract_data, missing_fields }
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import type {
  ContractData,
  MissingField,
} from "@/types/contracts"
import {
  ContractDataSchema,
  emptyContractData,
} from "@/types/contracts"
import { findMissingFields } from "./validation"
import {
  amountToSpanishWords,
  dateToSpanishWords,
} from "./number-to-words-service"

interface PrefillInput {
  property_id: string
  lead_id:     string | null
  /** When omitted, the prefill uses `property.owner_id`. Pass to
   *  override (e.g. when the agent corrects the auto-detected owner). */
  owner_id?:   string | null
  supabase:    SupabaseClient<Database>
}

export interface PrefillResult {
  contract_data:  ContractData
  /** Fields the gate would block on if the user clicked "Finalize"
   *  right now. The wizard uses this to render the checklist. */
  missing_fields: MissingField[]
  /** Diagnostic info — which sources contributed to the prefill. The
   *  wizard surfaces this in a "Datos cargados de…" hint. */
  sources: {
    property:           boolean
    owner:              boolean
    lead:               boolean
    project:            boolean
    /** True when we pulled landlord legal PII from a prior contract. */
    prior_contract_pii: boolean
  }
}

export async function prefillContractData(
  input: PrefillInput,
): Promise<PrefillResult> {
  const { supabase, property_id, lead_id } = input

  // ── 1. Property ─────────────────────────────────────────────
  const { data: property } = await supabase
    .from("properties")
    .select(`
      id, title, currency, price, bedrooms, bathrooms, floor,
      parking_spaces, display_address, owner_id, amenities,
      maintenance_fee, project_id
    `)
    .eq("id", property_id)
    .is("deleted_at", null)
    .maybeSingle()

  if (!property) {
    // No property → return empty data + a synthetic missing-field
    // for the property itself so the wizard can recover.
    const data = emptyContractData()
    return {
      contract_data: data,
      missing_fields: findMissingFields(data),
      sources: {
        property: false, owner: false, lead: false,
        project: false, prior_contract_pii: false,
      },
    }
  }

  // ── 2. Owner (preferred via override, fallback to property.owner_id) ─
  const ownerId = input.owner_id ?? property.owner_id ?? null
  const { data: owner } = ownerId
    ? await supabase
        .from("owners")
        .select("id, full_name, id_number, email, phone")
        .eq("id", ownerId)
        .is("deleted_at", null)
        .maybeSingle()
    : { data: null }

  // ── 3. Project (for condominium_name fallback) ──────────────
  const { data: project } = property.project_id
    ? await supabase
        .from("projects")
        .select("id, title, location_label")
        .eq("id", property.project_id)
        .is("deleted_at", null)
        .maybeSingle()
    : { data: null }

  // ── 4. Lead (tenant info) ───────────────────────────────────
  const { data: lead } = lead_id
    ? await supabase
        .from("leads")
        .select("id, full_name, email, phone")
        .eq("id", lead_id)
        .is("deleted_at", null)
        .maybeSingle()
    : { data: null }

  // ── 5. Most-recent prior contract for the SAME owner — used to
  //     reuse landlord legal PII (civil_status, profession, domicile,
  //     bank_name, iban, …) so the agent doesn't retype it every time.
  type PriorRow = { contract_data: unknown; created_at: string }
  const { data: prior } = ownerId
    ? await supabase
        .from("contracts")
        .select("contract_data, created_at")
        .eq("owner_id", ownerId)
        .eq("contract_type", "rental")
        .not("contract_data", "is", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null as PriorRow | null }

  const priorPii = extractLandlordPii(prior?.contract_data)

  // ── 6. Compose ContractData ─────────────────────────────────
  const data = emptyContractData()

  // -- contract meta
  data.contract.title = property.title ?? data.contract.title
  data.contract.city  = "San José"  // CR default; user can override

  // -- landlord (owner contact + reused legal PII)
  if (owner) {
    data.landlord.full_name = owner.full_name ?? ""
    data.landlord.id_number = owner.id_number ?? ""
    data.landlord.email     = owner.email     ?? ""
    data.landlord.phone     = owner.phone     ?? ""
  }
  if (priorPii) {
    data.landlord.civil_status               = priorPii.civil_status               || data.landlord.civil_status
    data.landlord.profession                 = priorPii.profession                 || data.landlord.profession
    data.landlord.domicile                   = priorPii.domicile                   || data.landlord.domicile
    data.landlord.bank_name                  = priorPii.bank_name                  || data.landlord.bank_name
    data.landlord.iban                       = priorPii.iban                       || data.landlord.iban
    data.landlord.payment_confirmation_email =
      priorPii.payment_confirmation_email || data.landlord.payment_confirmation_email
  }

  // -- tenant (from lead)
  if (lead) {
    data.tenant.full_name = lead.full_name ?? ""
    data.tenant.email     = lead.email     ?? ""
    data.tenant.phone     = lead.phone     ?? ""
  }

  // -- property
  data.property.title          = property.title ?? ""
  data.property.bedrooms       = property.bedrooms ?? 0
  data.property.bathrooms      = property.bathrooms ?? 0
  data.property.parking_spaces = property.parking_spaces ?? 0
  data.property.floor          = property.floor != null ? String(property.floor) : ""
  data.property.included_items = (property.amenities as string[] | null) ?? []
  if (property.display_address) {
    // Best-effort parse — Costa Rican addresses from Google Places look
    // like one of:
    //   • "Cond. del Río, Brasil, Santa Ana, San José, 10906, Costa Rica"
    //   • "Cond. X, Mata Redonda, Ciudad de San José,
    //      Área Metropolitana de San José, San José, 10906, Costa Rica"
    // The "Área Metropolitana de [X]" / "Gran Área Metropolitana"
    // segment is a regional label that shifts the last-3 slice off by
    // one, so we strip it. We also drop the "Ciudad de " prefix that
    // Google attaches to the canton name in the capital so the legal
    // text reads "San José" instead of "Ciudad de San José".
    const parts   = property.display_address.split(",").map((s) => s.trim()).filter(Boolean)
    const cleaned = parts.filter((p) =>
      !/^\d{4,6}$/.test(p) &&
      !/costa\s+rica/i.test(p) &&
      !/^(área|area|gran área|gran area)\s+metropolitana/i.test(p),
    )
    if (cleaned.length >= 3) {
      const canton = cleaned[cleaned.length - 2] ?? ""
      data.property.province = cleaned[cleaned.length - 1] ?? ""
      data.property.canton   = canton.replace(/^ciudad\s+de\s+/i, "")
      data.property.district = cleaned[cleaned.length - 3] ?? ""
    }
  }
  if (project) {
    data.property.condominium_name = project.title ?? ""
  }

  // -- payments
  if (property.price != null) {
    const amount = Number(property.price)
    data.payments.rent_amount = Number.isFinite(amount) ? amount : 0
    data.payments.rent_amount_words = data.payments.rent_amount > 0
      ? amountToSpanishWords(data.payments.rent_amount, data.payments.rent_currency)
      : ""
  }
  if (property.currency === "USD" || property.currency === "CRC") {
    data.payments.rent_currency    = property.currency
    data.payments.deposit_currency = property.currency
  }
  // Default deposit = one month of rent (industry practice).
  if (data.payments.rent_amount > 0 && data.payments.deposit_amount === 0) {
    data.payments.deposit_amount = data.payments.rent_amount
    data.payments.deposit_amount_words = amountToSpanishWords(
      data.payments.deposit_amount,
      data.payments.deposit_currency,
    )
  }
  // Maintenance included if maintenance_fee column is null OR 0.
  // Otherwise the agent collects it on top of rent.
  data.payments.maintenance_included = !property.maintenance_fee || Number(property.maintenance_fee) === 0

  // -- terms — only term_months default; the agent fills the dates.
  if (data.terms.start_date && data.terms.end_date === "" && data.terms.term_months) {
    // (Date arithmetic happens client-side once the agent picks a start_date.)
  }

  // -- words for any dates the agent may have already typed in
  if (data.terms.start_date) {
    try { data.terms.start_date_words = dateToSpanishWords(data.terms.start_date) }
    catch { /* invalid, leave blank */ }
  }
  if (data.terms.end_date) {
    try { data.terms.end_date_words = dateToSpanishWords(data.terms.end_date) }
    catch { /* invalid */ }
  }

  // ── 7. Validate against the schema (strips unknown keys, fills
  //     defaults, throws on type errors). ──────────────────────
  const parsed = ContractDataSchema.parse(data)

  return {
    contract_data: parsed,
    missing_fields: findMissingFields(parsed),
    sources: {
      property:           true,
      owner:              !!owner,
      lead:               !!lead,
      project:            !!project,
      prior_contract_pii: !!priorPii,
    },
  }
}

/**
 * Pull just the legal PII fields from a prior contract's `contract_data`
 * jsonb. Tolerant of malformed historical data — returns null if the
 * shape doesn't match.
 */
function extractLandlordPii(raw: unknown): {
  civil_status:               string
  profession:                 string
  domicile:                   string
  bank_name:                  string
  iban:                       string
  payment_confirmation_email: string
} | null {
  if (!raw || typeof raw !== "object") return null
  const root = raw as Record<string, unknown>
  const ll = root.landlord
  if (!ll || typeof ll !== "object") return null
  const l = ll as Record<string, unknown>
  const pick = (k: string): string => {
    const v = l[k]
    return typeof v === "string" ? v : ""
  }
  return {
    civil_status:               pick("civil_status"),
    profession:                 pick("profession"),
    domicile:                   pick("domicile"),
    bank_name:                  pick("bank_name"),
    iban:                       pick("iban"),
    payment_confirmation_email: pick("payment_confirmation_email"),
  }
}
