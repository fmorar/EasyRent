// ============================================================
// Generation orchestrator — given a contract row id (or a fresh
// `template_id + contract_data`), produce:
//
//   • editor_content_html  — placeholders resolved against
//     `contract_data` (unresolved tokens preserved literally),
//     plus a few synthetic placeholders computed here:
//       payments.maintenance_clause          (Sí / No / sin definir)
//       payments.maintenance_included_clause (mantenimiento incluido)
//   • generated_plain_text — readable plain text (for fts/search).
//   • warnings             — from the health-check service.
//   • missing_fields       — from the validation service.
//
// This service is pure (no DB) — the API layer wraps it with the
// row load/persist. Keeps it easy to test.
// ============================================================

import type {
  ContractData,
  ContractGenerationResult,
} from "@/types/contracts"
import {
  resolvePlaceholders,
  htmlToPlainText,
} from "./contract-placeholder-service"
import { runHealthCheck } from "./contract-template-health-check-service"
import { findMissingFields } from "./validation"
import {
  amountToSpanishWords,
  dateToSpanishWords,
} from "./number-to-words-service"

interface GenerateInput {
  /** Raw template HTML (from `contract_templates.template_content`). */
  template_html: string
  /** The structured payload. We don't mutate it. */
  contract_data: ContractData
}

/**
 * Run the full pipeline. Synchronous, deterministic. Safe to call
 * many times; each call re-derives every word-form / synthetic
 * placeholder from `contract_data`.
 */
export function generateContractDraft(
  input: GenerateInput,
): ContractGenerationResult {
  // 1. Derive computed fields (word forms + synthetic clauses) and
  //    splice them into a working copy of contract_data.
  const data = withDerivedFields(input.contract_data)

  // 2. Replace placeholders.
  const resolved = resolvePlaceholders(input.template_html, data)

  // 3. Build plain-text projection for full-text search.
  const plain = htmlToPlainText(resolved.html)

  // 4. Run health checks against the rendered HTML + data.
  const warnings = runHealthCheck({
    html:          resolved.html,
    template_html: input.template_html,
    contract_data: data,
    unresolved:    resolved.unresolved,
  })

  // 5. Required-fields gate.
  const missing = findMissingFields(data)

  return {
    html:           resolved.html,
    json:           data,
    plain_text:     plain,
    warnings,
    missing_fields: missing,
  }
}

/**
 * Compute word-form fields and synthetic clauses on a SHALLOW copy of
 * `contract_data`. We don't write these back to the DB — they're
 * regenerated on every render so the agent doesn't see stale words
 * if they edit the structured value later.
 */
function withDerivedFields(data: ContractData): ContractData {
  // Spread top-level + every section so we don't mutate the caller's
  // object. Cheap because the object is shallow.
  const d: ContractData = {
    ...data,
    contract: { ...data.contract },
    landlord: { ...data.landlord },
    tenant:   { ...data.tenant   },
    property: { ...data.property },
    terms:    { ...data.terms    },
    payments: { ...data.payments },
    delivery: { ...data.delivery },
    rules:    { ...data.rules    },
    special_clauses: data.special_clauses.slice(),
  }

  // ── Date words ──────────────────────────────────────────────
  if (d.terms.start_date) {
    try { d.terms.start_date_words = dateToSpanishWords(d.terms.start_date) }
    catch { /* leave blank — health check flags via stale_date_words */ }
  }
  if (d.terms.end_date) {
    try { d.terms.end_date_words = dateToSpanishWords(d.terms.end_date) }
    catch { /* leave blank */ }
  }
  if (d.contract.signing_date) {
    try { d.contract.signing_date_words = dateToSpanishWords(d.contract.signing_date) }
    catch { /* leave blank */ }
  }

  // ── Amount words (regenerate every time so they stay in sync
  //    with the numeric value the agent typed) ─────────────────
  if (d.payments.rent_amount > 0) {
    d.payments.rent_amount_words = amountToSpanishWords(
      d.payments.rent_amount, d.payments.rent_currency,
    )
  }
  if (d.payments.deposit_amount > 0) {
    d.payments.deposit_amount_words = amountToSpanishWords(
      d.payments.deposit_amount, d.payments.deposit_currency,
    )
  }

  // ── Synthetic placeholders for the maintenance clauses ──────
  // The template references `{{payments.maintenance_clause}}` and
  // `{{payments.maintenance_included_clause}}` which aren't real
  // ContractData fields — we splice them in here so they resolve.
  const synth = d as unknown as Record<string, Record<string, string>>
  synth.payments.maintenance_clause = d.payments.maintenance_included
    ? "El precio del arriendo incluye la cuota de mantenimiento condominal."
    : `El precio del arriendo NO incluye la cuota de mantenimiento condominal, la cual deberá ser cancelada por separado por LA PARTE ARRENDATARIA conforme al monto establecido por la administración del condominio.`
  synth.payments.maintenance_included_clause = d.payments.maintenance_included
    ? "con mantenimiento incluido"
    : "sin mantenimiento incluido"

  // ── Synthetic identification blocks for both parties ────────
  // The template uses `{{landlord.identification_block}}` and
  // `{{tenant.identification_block}}` instead of inlining each PII
  // field. The block string adapts to id_type (cédula vs pasaporte
  // vs DIMEX) so the contract begs only for the fields that ARE
  // relevant. The strings can contain inner `{{...}}` placeholders
  // (e.g. `{{tenant.civil_status}}`) for fields the user still has
  // to fill — those resolve in the next pass of the placeholder
  // service.
  synth.landlord.identification_block = buildIdentificationBlock(d, "landlord")
  synth.tenant.identification_block   = buildIdentificationBlock(d, "tenant")

  // ── Title fallback when the wizard's title is empty ─────────
  if (!d.contract.title.trim() && d.property.title) {
    d.contract.title = `Contrato de arrendamiento — ${d.property.title}`
  }

  return d
}

/**
 * Build the legal identification clause for a party (landlord or
 * tenant). The clause adapts to `id_type`:
 *
 *   cédula   → "<full_name>, mayor, cédula <id>, <civil_status>,
 *               <profession>, <vecino de | con domicilio en> <domicile>"
 *   pasaporte → "<full_name>, mayor, portador del número de pasaporte
 *                <id>, emitido por el gobierno de <country>, de
 *                nacionalidad <nationality> (tenant only),
 *                <civil_status>, <profession>, <vecino…> <domicile>"
 *   dimex     → "<full_name>, mayor, portador del documento DIMEX
 *                <id>, …"
 *   other     → "<full_name>, mayor, portador del documento <id>, …"
 *
 * Missing fields are emitted as `{{party.field}}` literals so the
 * placeholder service flags them on the next pass — the user sees a
 * highlighted "to-fill" marker AND a warning, but only for fields
 * actually required by the chosen id_type.
 *
 * Note: only the tenant has a `nationality` field in ContractData;
 * we guard with the partyKey check.
 */
function buildIdentificationBlock(
  d: ContractData,
  partyKey: "landlord" | "tenant",
): string {
  const party = d[partyKey]
  // The "vecino de" phrasing is conventional in CR for tenants and
  // "con domicilio en" for landlords — preserve the asymmetry.
  const domicilePrefix = partyKey === "landlord" ? "con domicilio en" : "vecino de"

  const segs: string[] = []

  // Name + age qualifier (always rendered; falls back to placeholder).
  segs.push(
    `<strong>${party.full_name || `{{${partyKey}.full_name}}`}</strong>, mayor`,
  )

  // Document clause — branches on id_type.
  const id = party.id_number || `{{${partyKey}.id_number}}`
  if (party.id_type === "cedula") {
    segs.push(`cédula <strong>${id}</strong>`)
  } else if (party.id_type === "passport") {
    const country = (party as ContractData["tenant"]).passport_country
      || `{{${partyKey}.passport_country}}`
    segs.push(
      `portador del número de pasaporte <strong>${id}</strong>, emitido por el gobierno de ${country}`,
    )
    if (partyKey === "tenant") {
      const nat = d.tenant.nationality || `{{tenant.nationality}}`
      segs.push(`de nacionalidad ${nat}`)
    }
  } else if (party.id_type === "dimex") {
    segs.push(`portador del documento DIMEX <strong>${id}</strong>`)
  } else {
    segs.push(`portador del documento <strong>${id}</strong>`)
  }

  // Civil status + profession + domicile. We always render them so
  // the prose is grammatically complete; missing values become
  // visible placeholders the user can fill.
  segs.push(party.civil_status || `{{${partyKey}.civil_status}}`)
  segs.push(party.profession   || `{{${partyKey}.profession}}`)
  segs.push(`${domicilePrefix} ${party.domicile || `{{${partyKey}.domicile}}`}`)

  return segs.join(", ")
}
