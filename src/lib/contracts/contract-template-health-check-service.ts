// ============================================================
// Template health-check — scan the rendered HTML and the structured
// `contract_data` for common issues:
//
//   1. Stale literals from a copy-pasted template (NOMBRE COMPLETO,
//      KHAYA, $XXXX, FECHA EN LETRAS, etc.). High severity.
//   2. Unresolved `{{...}}` placeholders. Medium severity.
//   3. Internal contradictions in `contract_data` (rent currency vs
//      deposit currency, parking_spaces vs parking_folio_real,
//      passport id_type vs missing passport_country, etc.).
//
// The service is pure and sync. It DOES NOT mutate or auto-fix
// anything — the user reviews and fixes via the wizard form or the
// editor. This is by design: the template carries legal text we
// must not silently rewrite.
// ============================================================

import type {
  ContractData, HealthWarning, WarningSeverity,
} from "@/types/contracts"
import { extractPlaceholders } from "./contract-placeholder-service"

// ── Stale-literal patterns ───────────────────────────────────────
//
// These are typical leftovers when someone copy-pastes a real
// contract into a template without scrubbing it. Each entry is
// `[regex, severity, code, title, description]`.
//
// Patterns are case-insensitive and word-bounded where practical.
// A pattern matching the rendered HTML produces a warning even if
// the same pattern still exists inside the template's source.

interface StaleLiteralRule {
  pattern:     RegExp
  severity:    WarningSeverity
  code:        string
  title:       string
  description: string
  suggested:   string
}

const STALE_LITERALS: readonly StaleLiteralRule[] = [
  {
    pattern: /\bNOMBRE\s+COMPLETO\b/i,
    severity: "high",
    code: "stale_full_name",
    title: 'Texto literal "NOMBRE COMPLETO" en el contrato',
    description: 'El contrato todavía contiene el texto "NOMBRE COMPLETO". Reemplazalo con el nombre real del arrendante o arrendatario.',
    suggested: "Completá los nombres en la sección de partes y regenerá el borrador.",
  },
  {
    pattern: /\bESTADO\s+CIVIL\b/i,
    severity: "medium",
    code: "stale_civil_status",
    title: 'Texto literal "ESTADO CIVIL" en el contrato',
    description: 'Quedó el placeholder "ESTADO CIVIL" sin reemplazar.',
    suggested: "Completá el estado civil del arrendante y arrendatario.",
  },
  {
    pattern: /\bPROFESIONS?\b/i,
    severity: "medium",
    code: "stale_profession",
    title: 'Texto literal "PROFESION" en el contrato',
    description: 'Quedó el placeholder "PROFESION" sin reemplazar.',
    suggested: "Completá la profesión del arrendante y arrendatario.",
  },
  {
    pattern: /\bFECHA\s+EN\s+LETRAS\b/i,
    severity: "high",
    code: "stale_date_words",
    title: 'Texto literal "FECHA EN LETRAS" en el contrato',
    description: 'El contrato menciona "FECHA EN LETRAS" sin reemplazar. Las fechas legales se escriben con la fecha en palabras.',
    suggested: "Verificá las fechas de inicio y fin del contrato.",
  },
  {
    pattern: /\bPRECIO\s+DE\s+ALQUILER\b/i,
    severity: "high",
    code: "stale_rent_price",
    title: 'Texto literal "PRECIO DE ALQUILER" en el contrato',
    description: 'El contrato menciona "PRECIO DE ALQUILER" sin reemplazar.',
    suggested: "Completá el monto de alquiler en la sección de pagos.",
  },
  {
    pattern: /\bN[UÚ]MERO\s+DE\s+FINCA\s+EN\s+LETRAS\b/i,
    severity: "high",
    code: "stale_folio_words",
    title: 'Texto literal "NUMERO DE FINCA EN LETRAS"',
    description: 'El contrato menciona "NUMERO DE FINCA EN LETRAS" sin reemplazar.',
    suggested: "Completá el folio real en palabras del apartamento o parqueo.",
  },
  {
    pattern: /\bMONTO\s+EN\s+LETRAS\b/i,
    severity: "high",
    code: "stale_amount_words",
    title: 'Texto literal "MONTO EN LETRAS"',
    description: 'El contrato menciona "MONTO EN LETRAS" sin reemplazar (suele referirse al depósito o al alquiler).',
    suggested: "Completá los montos en palabras de alquiler y depósito.",
  },
  {
    pattern: /\$\s*XXXX\b/i,
    severity: "high",
    code: "stale_dollars_xxxx",
    title: 'Texto literal "$XXXX" en el contrato',
    description: 'El contrato contiene "$XXXX" sin reemplazar.',
    suggested: "Completá el monto de alquiler con su valor real.",
  },
  {
    pattern: /CRC\s*\$?\s*x{4,}/i,
    severity: "high",
    code: "stale_crc_xxx",
    title: 'Texto literal "CRC $xxxxxxx" en el contrato',
    description: 'El contrato contiene un monto en colones sin reemplazar.',
    suggested: "Completá el monto del depósito o alquiler en colones.",
  },
  {
    pattern: /\bIBAN:?\s*CR[xX]+/i,
    severity: "high",
    code: "stale_iban",
    title: 'IBAN literal sin reemplazar',
    description: 'El contrato muestra "CRxxxxxxx…" como IBAN, no un número real.',
    suggested: "Completá el IBAN del arrendante en la sección de pagos.",
  },
  {
    pattern: /\bEMAIL\b/,
    severity: "medium",
    code: "stale_email",
    title: 'Texto literal "EMAIL" en el contrato',
    description: 'Quedó la palabra "EMAIL" sin reemplazar por una dirección real.',
    suggested: "Completá los correos electrónicos del arrendante.",
  },
  {
    pattern: /#{6,}/,
    severity: "high",
    code: "stale_hashes",
    title: "Secuencia de # como número",
    description: 'El contrato muestra "######…" en lugar de un número (cédula, pasaporte, folio…).',
    suggested: "Completá el número correspondiente en la sección de partes o propiedad.",
  },
  // Domain literals from the canonical template that should never
  // survive a scrubbed render. If they appear, the user copy-pasted
  // the original contract instead of the placeholder version.
  {
    pattern: /\bKHAYA\b/i,
    severity: "high",
    code: "stale_condominium_khaya",
    title: 'Nombre de condominio literal "KHAYA"',
    description: "El contrato hace referencia al condominio Khaya, que es solo el ejemplo de la plantilla original.",
    suggested: "Reemplazá con el nombre del condominio real en la sección de propiedad.",
  },
  {
    pattern: /\bCURRIDABAT\b/i,
    severity: "low",
    code: "stale_canton_curridabat",
    title: 'Cantón literal "CURRIDABAT"',
    description: "El contrato menciona Curridabat, que es solo el ejemplo de la plantilla original.",
    suggested: "Verificá el cantón real en la sección de propiedad.",
  },
] as const

// ── Public API ───────────────────────────────────────────────────

interface CheckInput {
  /** Rendered HTML (post-placeholder-replacement) — the document the
   *  owner will read. */
  html:          string
  /** Original template HTML — used to know which placeholders the
   *  template references. */
  template_html: string
  /** The structured data the placeholders were resolved against. */
  contract_data: ContractData
  /** Placeholders that resolvePlaceholders() couldn't fill. */
  unresolved:    string[]
}

export function runHealthCheck(input: CheckInput): HealthWarning[] {
  const warnings: HealthWarning[] = []

  // 1. Stale literals — scan the RENDERED HTML.
  for (const rule of STALE_LITERALS) {
    if (rule.pattern.test(input.html)) {
      warnings.push({
        severity:         rule.severity,
        code:             rule.code,
        title:            rule.title,
        description:      rule.description,
        field_path:       null,
        suggested_action: rule.suggested,
      })
    }
  }

  // 2. Unresolved placeholders.
  for (const path of input.unresolved) {
    warnings.push({
      severity:         "medium",
      code:             "unresolved_placeholder",
      title:            `Placeholder sin completar: ${path}`,
      description:      `El campo "${path}" no se completó. El contrato muestra {{${path}}} en su lugar.`,
      field_path:       path,
      suggested_action: "Completá el campo correspondiente en el wizard.",
    })
  }

  // 3. Internal contradictions — read from structured data.
  const d = input.contract_data
  const p = d.payments
  const t = d.terms
  const prop = d.property
  const tenant = d.tenant
  const landlord = d.landlord

  // Currency mismatch: rent and deposit in different currencies is
  // unusual but legal — flag as low severity to confirm.
  if (p.rent_currency && p.deposit_currency && p.rent_currency !== p.deposit_currency) {
    warnings.push({
      severity: "low",
      code:     "currency_mismatch",
      title:    "El alquiler y el depósito están en monedas distintas",
      description: `Alquiler en ${p.rent_currency} y depósito en ${p.deposit_currency}. Aunque es legal, conviene confirmar con el dueño.`,
      field_path: "payments.deposit_currency",
      suggested_action: "Confirmá la moneda del depósito o ajustá una de las dos.",
    })
  }

  // Payment-day order: due day must come before "last day without default".
  if (p.payment_due_day && p.last_payment_day_without_default &&
      p.payment_due_day > p.last_payment_day_without_default) {
    warnings.push({
      severity: "high",
      code:     "payment_days_inverted",
      title:    "Día de pago vs. fecha límite están invertidos",
      description: `El día de pago (${p.payment_due_day}) es posterior al último día sin mora (${p.last_payment_day_without_default}).`,
      field_path: "payments.last_payment_day_without_default",
      suggested_action: "Ajustá las fechas para que el día sin mora sea posterior al de pago.",
    })
  }

  // Date order.
  if (t.start_date && t.end_date) {
    const s = new Date(t.start_date)
    const e = new Date(t.end_date)
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && s.getTime() >= e.getTime()) {
      warnings.push({
        severity: "high",
        code:     "dates_inverted",
        title:    "La fecha de inicio es igual o posterior a la de fin",
        description: `Inicio: ${t.start_date} · Fin: ${t.end_date}.`,
        field_path: "terms.end_date",
        suggested_action: "Ajustá las fechas del contrato.",
      })
    }
  }

  // Term consistency: term_months should match the date range
  // (within ±1 month tolerance for end-of-month edge cases).
  if (t.term_months && t.start_date && t.end_date) {
    const s = new Date(t.start_date)
    const e = new Date(t.end_date)
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime())) {
      const months = (e.getFullYear() - s.getFullYear()) * 12 +
                     (e.getMonth() - s.getMonth())
      if (Math.abs(months - t.term_months) > 1) {
        warnings.push({
          severity: "medium",
          code:     "term_months_mismatch",
          title:    "Plazo declarado no coincide con las fechas",
          description: `Plazo: ${t.term_months} meses. Diferencia entre fechas: ${months} meses.`,
          field_path: "terms.term_months",
          suggested_action: "Ajustá el plazo o las fechas para que coincidan.",
        })
      }
    }
  }

  // Parking declared but no folio.
  if (prop.parking_spaces > 0 && !prop.parking_folio_real.trim()) {
    warnings.push({
      severity: "medium",
      code:     "parking_no_folio",
      title:    "Hay parqueo pero falta el folio real",
      description: `La propiedad declara ${prop.parking_spaces} parqueo(s) pero no se ingresó el folio real del parqueo.`,
      field_path: "property.parking_folio_real",
      suggested_action: "Completá el folio real del parqueo o eliminá la mención.",
    })
  }

  // Passport tenant but no country.
  if (tenant.id_type === "passport" && !tenant.passport_country.trim()) {
    warnings.push({
      severity: "medium",
      code:     "passport_no_country",
      title:    "Pasaporte sin país emisor",
      description: "El arrendatario declara pasaporte pero no se indicó el país que lo emitió.",
      field_path: "tenant.passport_country",
      suggested_action: "Completá el país emisor del pasaporte.",
    })
  }

  // Bank transfer payment but no IBAN.
  if (p.payment_method === "bank_transfer" && !landlord.iban.trim()) {
    warnings.push({
      severity: "high",
      code:     "transfer_no_iban",
      title:    "Pago por transferencia sin IBAN",
      description: "El método de pago es transferencia bancaria pero el IBAN del arrendante está vacío.",
      field_path: "landlord.iban",
      suggested_action: "Completá el IBAN del arrendante.",
    })
  }

  // Bank transfer payment but no confirmation email.
  if (p.payment_method === "bank_transfer" && !landlord.payment_confirmation_email.trim()) {
    warnings.push({
      severity: "medium",
      code:     "transfer_no_confirmation_email",
      title:    "Falta correo para notificar comprobantes",
      description: "El contrato pide notificar comprobantes a un correo del arrendante pero ese campo está vacío.",
      field_path: "landlord.payment_confirmation_email",
      suggested_action: "Completá el correo donde el inquilino enviará comprobantes.",
    })
  }

  // Template references placeholders the data doesn't fill (drift).
  const referenced = extractPlaceholders(input.template_html)
  const filled     = new Set(referenced.filter((p) => !input.unresolved.includes(p)))
  const drift      = referenced.filter((p) => !filled.has(p))
  // We already report unresolved tokens; this is a lower-severity
  // structural notice that helps the maintainer audit the template.
  // Skip if it would dup-report unresolved.
  void drift  // intentionally unused — placeholder for future template-author UI

  return warnings
}

/** Group warnings by severity for UI rendering. */
export function groupBySeverity(
  warnings: HealthWarning[],
): Record<WarningSeverity, HealthWarning[]> {
  const acc: Record<WarningSeverity, HealthWarning[]> = {
    high: [], medium: [], low: [],
  }
  for (const w of warnings) acc[w.severity].push(w)
  return acc
}
