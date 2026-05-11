// ============================================================
// Spanish number-to-words and date-to-words for legal documents.
//
// Output is uppercased to match the convention of Costa Rican lease
// templates ("MIL DOSCIENTOS DÓLARES EXACTOS"). The service is pure
// (no I/O, no clock, no locale provider) so it's trivially testable.
//
// Currency support: USD ("DÓLARES") + CRC ("COLONES"). Adding a new
// currency only requires extending CURRENCY_NAMES.
//
// Date format: "DÍA DE MES DEL AÑO YEAR_WORDS" — Costa Rica notarial
// convention. Day 1 is rendered as "PRIMERO" (CR/legal practice);
// other days use cardinal words.
// ============================================================

import type { RentCurrency } from "@/types/contracts"

// ── Word tables ──────────────────────────────────────────────────

const UNITS = [
  "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete",
  "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince",
  "dieciséis", "diecisiete", "dieciocho", "diecinueve",
]

const TENS = [
  "", "", "veinte", "treinta", "cuarenta", "cincuenta",
  "sesenta", "setenta", "ochenta", "noventa",
]

const HUNDREDS = [
  "",
  "ciento", // "cien" is special-cased when n === 100
  "doscientos", "trescientos", "cuatrocientos", "quinientos",
  "seiscientos", "setecientos", "ochocientos", "novecientos",
]

const MONTHS = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SETIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
]

interface CurrencyWord {
  /** Singular noun used in the spelled-out amount. */
  noun:   string
  /** Plural form (most amounts other than 1 use plural). */
  plural: string
}

const CURRENCY_NAMES: Record<RentCurrency, CurrencyWord> = {
  USD: { noun: "DÓLAR",  plural: "DÓLARES"  },
  CRC: { noun: "COLÓN",  plural: "COLONES"  },
}

// ── Helpers ──────────────────────────────────────────────────────

/** 0..99 → words (lowercase). */
function under100(n: number): string {
  if (n < 20) return UNITS[n]
  if (n < 30) {
    // Special "veinti…" forms (no space, no "y"): veintiuno, veintidós…
    const ones = n - 20
    if (ones === 0) return "veinte"
    return "veinti" + (
      ones === 2 ? "dós"   :
      ones === 3 ? "trés"  :
      ones === 6 ? "séis"  :
      UNITS[ones]
    )
  }
  const tens = Math.floor(n / 10)
  const ones = n % 10
  if (ones === 0) return TENS[tens]
  return `${TENS[tens]} y ${UNITS[ones]}`
}

/** 0..999 → words (lowercase). */
function under1000(n: number): string {
  if (n === 0)   return "cero"
  if (n === 100) return "cien"
  const hundreds = Math.floor(n / 100)
  const rest     = n % 100
  const head     = hundreds > 0 ? HUNDREDS[hundreds] : ""
  if (rest === 0)  return head
  if (head === "") return under100(rest)
  return `${head} ${under100(rest)}`
}

/** Strip "uno" tail when it should be "un" (before a noun like "millón" or
 *  any noun, e.g. "veintiún millones"). Only applies to the very last token. */
function unoToUn(s: string): string {
  if (s === "uno")          return "un"
  if (s.endsWith(" uno"))   return s.slice(0, -4) + " un"
  // veintiuno → veintiún
  if (s === "veintiuno")    return "veintiún"
  if (s.endsWith(" veintiuno")) return s.slice(0, -10) + " veintiún"
  return s
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Convert a non-negative integer to Spanish words. Handles values
 * up to 999,999,999,999 (one trillion, exclusive). Returns lowercase.
 *
 *   integerToSpanishWords(0)        → "cero"
 *   integerToSpanishWords(1)        → "uno"
 *   integerToSpanishWords(21)       → "veintiuno"
 *   integerToSpanishWords(100)      → "cien"
 *   integerToSpanishWords(1_200)    → "mil doscientos"
 *   integerToSpanishWords(650_000)  → "seiscientos cincuenta mil"
 *   integerToSpanishWords(1_000_000) → "un millón"
 *   integerToSpanishWords(2_026)    → "dos mil veintiséis"
 */
export function integerToSpanishWords(n: number): string {
  if (!Number.isFinite(n))      throw new Error("integerToSpanishWords: not finite")
  if (!Number.isInteger(n))     throw new Error("integerToSpanishWords: not integer")
  if (n < 0)                    throw new Error("integerToSpanishWords: negative")
  if (n >= 1_000_000_000_000)   throw new Error("integerToSpanishWords: too large")

  if (n < 1000)       return under1000(n)

  // Thousands group (1000..999999).
  if (n < 1_000_000) {
    const thousands = Math.floor(n / 1000)
    const rest      = n % 1000
    const head =
      thousands === 1
        ? "mil"
        : `${unoToUn(under1000(thousands))} mil`
    if (rest === 0) return head
    return `${head} ${under1000(rest)}`
  }

  // Millions group (1_000_000..999_999_999_999).
  const millions   = Math.floor(n / 1_000_000)
  const remainder  = n % 1_000_000
  const millionsWords = millions === 1
    ? "un millón"
    : `${unoToUn(integerToSpanishWords(millions))} millones`
  if (remainder === 0) return millionsWords
  return `${millionsWords} ${integerToSpanishWords(remainder)}`
}

/**
 * Format a monetary amount in legal Spanish:
 *
 *   amountToSpanishWords(1200, "USD")
 *   → "MIL DOSCIENTOS DÓLARES EXACTOS"
 *
 *   amountToSpanishWords(650_000, "CRC")
 *   → "SEISCIENTOS CINCUENTA MIL COLONES EXACTOS"
 *
 *   amountToSpanishWords(1_500.75, "USD")
 *   → "MIL QUINIENTOS DÓLARES CON 75/100"
 *
 * Cents are rendered as "CON XX/100" rather than spelled out — this
 * matches the convention used by Costa Rican notaries.
 */
export function amountToSpanishWords(amount: number, currency: RentCurrency): string {
  if (!Number.isFinite(amount)) throw new Error("amountToSpanishWords: not finite")
  if (amount < 0)               throw new Error("amountToSpanishWords: negative")

  const cents = Math.round((amount * 100) % 100)
  const whole = Math.floor(amount)

  // The currency table already carries singular and plural forms —
  // pick the right one rather than appending "S" generically (which
  // would mangle "DÓLAR" → "DÓLARS").
  const noun = whole === 1
    ? CURRENCY_NAMES[currency].noun
    : CURRENCY_NAMES[currency].plural
  const wholeWords = unoToUn(integerToSpanishWords(whole)).toUpperCase()

  if (cents === 0) return `${wholeWords} ${noun} EXACTOS`

  const centsStr = String(cents).padStart(2, "0")
  return `${wholeWords} ${noun} CON ${centsStr}/100`
}

/**
 * Format a date in Spanish notarial style (uppercase):
 *
 *   dateToSpanishWords(new Date("2026-05-07"))
 *   → "SIETE DE MAYO DEL AÑO DOS MIL VEINTISÉIS"
 *
 *   dateToSpanishWords(new Date("2026-08-01"))
 *   → "PRIMERO DE AGOSTO DEL AÑO DOS MIL VEINTISÉIS"
 *
 * Day 1 renders as "PRIMERO" (Costa Rica convention); other days use
 * cardinal words.
 *
 * Timezone-safe: the function uses UTC components when given an ISO
 * yyyy-mm-dd string. Pass a Date if you need local-zone behaviour.
 */
export function dateToSpanishWords(input: Date | string): string {
  const date = typeof input === "string" ? parseIsoDate(input) : input
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error("dateToSpanishWords: invalid date")
  }

  const day   = date.getUTCDate()
  const month = MONTHS[date.getUTCMonth()]
  const year  = date.getUTCFullYear()

  const dayWords = day === 1
    ? "PRIMERO"
    : integerToSpanishWords(day).toUpperCase()
  const yearWords = integerToSpanishWords(year).toUpperCase()

  return `${dayWords} DE ${month} DEL AÑO ${yearWords}`
}

/** Parse "yyyy-mm-dd" as UTC midnight to avoid timezone drift. */
function parseIsoDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (m) {
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  }
  // Fallback: let JS parse and normalize to UTC.
  return new Date(s)
}
