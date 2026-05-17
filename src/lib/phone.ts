/**
 * Phone-number helpers for the WhatsApp concierge + lead capture flow.
 *
 * Two things we care about:
 *
 *   1. **Normalize to E.164** for storage + lookup. WhatsApp delivers
 *      numbers in canonical "+50688888888" form; the rest of the app
 *      accepts whatever the user types. Storing both — the free-form
 *      `phone` (human-readable) AND the canonical `phone_e164`
 *      (lookup key) — lets every channel find the same lead.
 *
 *   2. **Format for display** so dashboards / emails show a phone the
 *      agent can copy + paste into their dialer without juggling
 *      the "+" prefix manually.
 *
 * We deliberately do NOT pull in `libphonenumber-js` (≈ 150 KB
 * gzipped). Costa Rica is our home market and ~95% of leads use a
 * +506 number; for everything else we fall back to "strip + prepend
 * if missing country code" which handles 99% of WhatsApp traffic.
 * If we ever expand outside CR-heavy traffic, swap this for the
 * full lib in one place.
 */

/** Two-letter ISO country code we default to when the raw input omits a country code. */
type DefaultCountry = "CR" | "US" | "MX" | "PA" | "GT" | "CO" | "PE"

/** Country-code mapping for the small set of defaults we support today. */
const DEFAULT_DIAL_CODE: Record<DefaultCountry, string> = {
  CR: "506",
  US: "1",
  MX: "52",
  PA: "507",
  GT: "502",
  CO: "57",
  PE: "51",
}

/** Twilio's WhatsApp prefix — `whatsapp:+50688888888`. */
const TWILIO_WA_PREFIX = "whatsapp:"

/**
 * Normalize a phone string to E.164 (`+506...`).
 *
 * Rules:
 *   • Strips Twilio's `whatsapp:` prefix when present.
 *   • Strips every non-digit (spaces, dashes, parens).
 *   • Keeps an existing `+` only as a signal that the country code is
 *     already there.
 *   • Empty / non-numeric input → `null` (callers should treat that as
 *     "skip" rather than write garbage to the DB).
 *
 * Best-effort, not bulletproof. Returns null rather than throwing so
 * the caller (server action, webhook) can decide what to do with a
 * malformed number — usually: log + skip.
 */
export function toE164(
  raw:            string | null | undefined,
  defaultCountry: DefaultCountry = "CR",
): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Strip the Twilio sender prefix so we accept both "+506…" and
  // "whatsapp:+506…" interchangeably.
  const sansPrefix = trimmed.startsWith(TWILIO_WA_PREFIX)
    ? trimmed.slice(TWILIO_WA_PREFIX.length)
    : trimmed

  // Was there an explicit + before we stripped non-digits? That's our
  // signal that the country code is already included.
  const hadPlus = sansPrefix.includes("+")
  const digits  = sansPrefix.replace(/\D/g, "")

  if (digits.length < 7) return null            // Too short to be a real number anywhere.
  if (digits.length > 15) return null           // E.164 max length.

  if (hadPlus) {
    // Trust the explicit "+" — caller said "this already has a CC".
    return `+${digits}`
  }

  // No "+" → caller gave us a local-format number. Prepend the
  // default country's dial code. If the digits already start with
  // that dial code (visitor wrote it out: "506 8888 8888"), don't
  // double up.
  const dial = DEFAULT_DIAL_CODE[defaultCountry]
  if (digits.startsWith(dial)) return `+${digits}`
  return `+${dial}${digits}`
}

/**
 * Strip Twilio's `whatsapp:` prefix and return the bare phone (E.164).
 * Useful when echoing a webhook's `From` / `To` back into a Twilio
 * API call expects the full `whatsapp:+…` form.
 */
export function stripWhatsAppPrefix(addr: string): string {
  return addr.startsWith(TWILIO_WA_PREFIX)
    ? addr.slice(TWILIO_WA_PREFIX.length)
    : addr
}

/**
 * Build Twilio's WhatsApp sender form (`whatsapp:+50688888888`) from
 * an E.164 number. Throws if input isn't E.164 — outbound sends must
 * never go through with a malformed number, fail fast.
 */
export function toTwilioWhatsAppAddr(e164: string): string {
  if (!/^\+\d{7,15}$/.test(e164)) {
    throw new Error(`toTwilioWhatsAppAddr: not a valid E.164 string: ${e164}`)
  }
  return `${TWILIO_WA_PREFIX}${e164}`
}

/**
 * Format an E.164 number for display in dashboards / emails.
 *
 * Costa Rican 8-digit numbers → "+506 8888 8888".
 * Anything else → grouped by 3 from the right with the country code
 * separated by a space ("+1 415 555 2671", "+52 55 1234 5678").
 */
export function formatPhoneDisplay(e164: string | null | undefined): string {
  if (!e164) return ""
  if (!e164.startsWith("+")) return e164
  const digits = e164.slice(1)

  // Costa Rica special-case: +506 followed by 8 digits → group 4 + 4.
  if (digits.startsWith("506") && digits.length === 11) {
    return `+506 ${digits.slice(3, 7)} ${digits.slice(7)}`
  }

  // Generic: take the leading 1-3 digits as country, group rest by 3
  // from the right. Cheap and works for most of LATAM + US.
  // Country code length heuristic: 1 (NANPA), else 2-3.
  const ccLen = digits.startsWith("1") ? 1 : digits.length <= 10 ? 2 : 3
  const cc   = digits.slice(0, ccLen)
  const rest = digits.slice(ccLen)
  // Group the national part by 3, starting from the LEFT (matches
  // how LATAM numbers are typically read out loud).
  const grouped = rest.replace(/(\d{3})(?=\d)/g, "$1 ")
  return `+${cc} ${grouped}`.trim()
}
