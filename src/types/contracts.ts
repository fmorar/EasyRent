// ============================================================
// Contracts module — domain shapes and Zod schemas.
//
// This file defines the **contract_data** payload (the structured
// JSON that lives in `contracts.contract_data`) and the wire types
// for the contract module. The DB-row aliases (Contract, ContractRow,
// etc.) live in `src/types/index.ts` and come from the auto-
// generated Supabase types.
//
// `contract_data` is the source of truth for every variable rendered
// inside the editor's HTML. Placeholders like `{{landlord.full_name}}`
// resolve from this object. Any field added here must have a matching
// placeholder entry in `default-template.ts` (or be a derived value).
// ============================================================

import { z } from "zod"

// ── Enums (string unions, declarative) ───────────────────────────
export const CONTRACT_TYPES = ["rental", "sale", "reservation"] as const
export type ContractTypeValue = (typeof CONTRACT_TYPES)[number]

export const ID_TYPES = ["cedula", "passport", "dimex", "other"] as const
export type IdType = (typeof ID_TYPES)[number]

export const CIVIL_STATUSES = [
  "soltero", "soltera",
  "casado",  "casada",
  "divorciado", "divorciada",
  "viudo", "viuda",
  "union_de_hecho",
  "otro",
] as const
export type CivilStatus = (typeof CIVIL_STATUSES)[number]

export const PETS_POLICIES = [
  "not_allowed",
  "requires_written_approval",
  "allowed",
] as const
export type PetsPolicy = (typeof PETS_POLICIES)[number]

export const PAYMENT_METHODS = [
  "bank_transfer",
  "cash",
  "check",
  "other",
] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const RENT_CURRENCIES = ["USD", "CRC"] as const
export type RentCurrency = (typeof RENT_CURRENCIES)[number]

// ── Zod schemas ──────────────────────────────────────────────────
//
// Validation strategy: schemas are PERMISSIVE so a partially-filled
// draft can persist (we want the user to save and come back). The
// `finalize()` validator in `lib/contracts/validation.ts` enforces
// the strict required-fields gate before transitioning to finalized.

const NonEmptyOrEmpty = z.string().trim()  // empty allowed in draft

export const ContractMetaSchema = z.object({
  type:               z.enum(CONTRACT_TYPES).default("rental"),
  country:            NonEmptyOrEmpty.default("CR"),
  language:           NonEmptyOrEmpty.default("es"),
  title:              NonEmptyOrEmpty.default(""),
  city:               NonEmptyOrEmpty.default("San José"),
  signing_date:       NonEmptyOrEmpty.default(""),       // ISO yyyy-mm-dd
  signing_date_words: NonEmptyOrEmpty.default(""),
})
export type ContractMeta = z.infer<typeof ContractMetaSchema>

export const LandlordSchema = z.object({
  full_name:                  NonEmptyOrEmpty.default(""),
  id_type:                    z.enum(ID_TYPES).default("cedula"),
  id_number:                  NonEmptyOrEmpty.default(""),
  civil_status:               NonEmptyOrEmpty.default(""),
  profession:                 NonEmptyOrEmpty.default(""),
  domicile:                   NonEmptyOrEmpty.default(""),
  email:                      NonEmptyOrEmpty.default(""),
  phone:                      NonEmptyOrEmpty.default(""),
  bank_name:                  NonEmptyOrEmpty.default(""),
  iban:                       NonEmptyOrEmpty.default(""),
  payment_confirmation_email: NonEmptyOrEmpty.default(""),
})
export type Landlord = z.infer<typeof LandlordSchema>

export const TenantSchema = z.object({
  full_name:        NonEmptyOrEmpty.default(""),
  id_type:          z.enum(ID_TYPES).default("passport"),
  id_number:        NonEmptyOrEmpty.default(""),
  passport_country: NonEmptyOrEmpty.default(""),
  nationality:      NonEmptyOrEmpty.default(""),
  civil_status:     NonEmptyOrEmpty.default(""),
  profession:       NonEmptyOrEmpty.default(""),
  domicile:         NonEmptyOrEmpty.default(""),
  email:            NonEmptyOrEmpty.default(""),
  phone:            NonEmptyOrEmpty.default(""),
})
export type Tenant = z.infer<typeof TenantSchema>

export const PropertyDataSchema = z.object({
  title:                    NonEmptyOrEmpty.default(""),
  condominium_name:         NonEmptyOrEmpty.default(""),
  unit_number:              NonEmptyOrEmpty.default(""),
  unit_number_words:        NonEmptyOrEmpty.default(""),
  folio_real:               NonEmptyOrEmpty.default(""),
  folio_real_words:         NonEmptyOrEmpty.default(""),
  parking_folio_real:       NonEmptyOrEmpty.default(""),
  parking_folio_real_words: NonEmptyOrEmpty.default(""),
  province:                 NonEmptyOrEmpty.default(""),
  canton:                   NonEmptyOrEmpty.default(""),
  district:                 NonEmptyOrEmpty.default(""),
  floor:                    NonEmptyOrEmpty.default(""),
  parking_floor:            NonEmptyOrEmpty.default(""),
  bedrooms:                 z.number().int().nonnegative().default(0),
  bathrooms:                z.number().nonnegative().default(0),
  parking_spaces:           z.number().int().nonnegative().default(0),
  use:                      NonEmptyOrEmpty.default("vivienda"),
  description:              NonEmptyOrEmpty.default(""),
  included_items:           z.array(z.string()).default([]),
})
export type PropertyData = z.infer<typeof PropertyDataSchema>

export const TermsSchema = z.object({
  start_date:                       NonEmptyOrEmpty.default(""),
  start_date_words:                 NonEmptyOrEmpty.default(""),
  end_date:                         NonEmptyOrEmpty.default(""),
  end_date_words:                   NonEmptyOrEmpty.default(""),
  // Costa Rica's Ley 7527 sets a 3-year minimum term for residential
  // leases — that's the practical default for every new contract.
  term_months:                      z.number().int().positive().default(36),
  auto_renewal:                     z.boolean().default(true),
  renewal_term_months:              z.number().int().positive().default(36),
  max_renewal_years:                z.number().int().positive().default(3),
  early_termination_notice_months:  z.number().int().positive().default(3),
})
export type Terms = z.infer<typeof TermsSchema>

export const PaymentsSchema = z.object({
  rent_amount:                     z.number().nonnegative().default(0),
  rent_amount_words:               NonEmptyOrEmpty.default(""),
  rent_currency:                   z.enum(RENT_CURRENCIES).default("USD"),
  maintenance_included:            z.boolean().default(true),
  deposit_amount:                  z.number().nonnegative().default(0),
  deposit_amount_words:            NonEmptyOrEmpty.default(""),
  deposit_currency:                z.enum(RENT_CURRENCIES).default("USD"),
  payment_due_day:                 z.number().int().min(1).max(31).default(1),
  last_payment_day_without_default: z.number().int().min(1).max(31).default(4),
  payment_method:                  z.enum(PAYMENT_METHODS).default("bank_transfer"),
})
export type Payments = z.infer<typeof PaymentsSchema>

export const DeliverySchema = z.object({
  keys_count:             z.number().int().nonnegative().default(1),
  access_cards_count:     z.number().int().nonnegative().default(1),
  vehicle_stickers_count: z.number().int().nonnegative().default(1),
})
export type Delivery = z.infer<typeof DeliverySchema>

export const RulesSchema = z.object({
  pets_allowed:                   z.enum(PETS_POLICIES).default("requires_written_approval"),
  sublease_allowed:               z.boolean().default(false),
  commercial_use_allowed:         z.boolean().default(false),
  condominium_rules_delivered:    z.boolean().default(true),
})
export type Rules = z.infer<typeof RulesSchema>

export const SpecialClauseSchema = z.object({
  title: z.string(),
  body:  z.string(),
})
export type SpecialClause = z.infer<typeof SpecialClauseSchema>

export const ContractDataSchema = z.object({
  contract: ContractMetaSchema,
  landlord: LandlordSchema,
  tenant:   TenantSchema,
  property: PropertyDataSchema,
  terms:    TermsSchema,
  payments: PaymentsSchema,
  delivery: DeliverySchema,
  rules:    RulesSchema,
  special_clauses: z.array(SpecialClauseSchema).default([]),
})
/** Full structured payload persisted as `contracts.contract_data` (jsonb). */
export type ContractData = z.infer<typeof ContractDataSchema>

/**
 * Build a fully-defaulted ContractData. Useful as the initial value
 * for the wizard form so every field is a controlled input. Parsing
 * each section against its own schema picks up the field-level
 * `.default()` values; we then assemble the parent object explicitly
 * (Zod v4 doesn't allow `.default({})` on a wrapping object schema
 * whose children have non-trivial defaults).
 */
export function emptyContractData(): ContractData {
  return {
    contract: ContractMetaSchema.parse({}),
    landlord: LandlordSchema.parse({}),
    tenant:   TenantSchema.parse({}),
    property: PropertyDataSchema.parse({}),
    terms:    TermsSchema.parse({}),
    payments: PaymentsSchema.parse({}),
    delivery: DeliverySchema.parse({}),
    rules:    RulesSchema.parse({}),
    special_clauses: [],
  }
}

// ── Validation / health-check value objects ──────────────────────

/** A required field the contract is missing before it can be finalized. */
export interface MissingField {
  /** Dotted path into ContractData, e.g. "landlord.full_name". */
  path:        string
  /** Short human label for the UI checklist. */
  label:       string
  /** Which wizard section the user has to revisit. */
  section:     "landlord" | "tenant" | "property" | "terms" | "payments"
}

/** Severity-tagged warning surfaced by the template-health-check service. */
export type WarningSeverity = "low" | "medium" | "high"

export interface HealthWarning {
  severity:         WarningSeverity
  /** Stable code so the UI can group/dedupe across re-runs. */
  code:             string
  title:            string
  description:      string
  /** Optional path to the field the user can fix. */
  field_path:       string | null
  suggested_action: string
}

/** Result of placeholder resolution against a template. */
export interface PlaceholderResolution {
  /** HTML with placeholders replaced by data values. */
  html:        string
  /** Placeholders that were referenced but had no value. */
  unresolved:  string[]
  /** Placeholders found in the template, in order of first occurrence. */
  found:       string[]
}

/** Output of the full generation pipeline. */
export interface ContractGenerationResult {
  html:           string
  json:           unknown
  plain_text:     string
  warnings:       HealthWarning[]
  missing_fields: MissingField[]
}

// ── Visibility / UI state types ──────────────────────────────────

/** Lightweight projection used by the contracts list table. */
export interface ContractListItem {
  id:              string
  title:           string | null
  status:          ContractStatusLifecycle
  contract_type:   ContractTypeValue
  property_id:     string | null
  property_title:  string | null
  tenant_name:     string | null
  rent_amount:     number | null
  rent_currency:   RentCurrency | null
  start_date:      string | null
  created_at:      string
  updated_at:      string
}

/** Subset of ContractStatus we use in the rental flow. The legacy
 * sale demo row uses `sent`/`voided` which we don't surface. */
export type ContractStatusLifecycle =
  | "draft"
  | "ready_for_review"
  | "finalized"
  | "signed"
  | "archived"

export const RENTAL_STATUS_LIFECYCLE: ContractStatusLifecycle[] = [
  "draft",
  "ready_for_review",
  "finalized",
  "signed",
  "archived",
]
