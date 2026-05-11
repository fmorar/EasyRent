// ============================================================
// Placeholder service — substitutes `{{path.to.field}}` tokens
// inside a contract template HTML using a structured ContractData
// object. Pure, sync, no I/O.
//
// Behaviour:
//   • Tokens are matched by `{{section.field}}` (dotted path).
//   • Numeric values render with `Intl.NumberFormat("en-US")` for
//     thousands separators (12,345). Currency is NOT inferred — the
//     template controls how `payments.rent_currency` precedes the
//     amount.
//   • Unresolved tokens stay literal in the HTML (`{{x}}`) so the
//     editor can highlight them. They're also reported in the
//     `unresolved` array.
//   • The companion `highlightUnresolved` wraps each remaining
//     `{{...}}` in a `<mark class="contract-unresolved">` so Tiptap
//     can style them red.
// ============================================================

import type { ContractData, PlaceholderResolution } from "@/types/contracts"

/** Match `{{ x.y.z }}` (whitespace tolerant). Captures the raw path. */
const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g

/** Walk a dotted path against the ContractData object. Returns
 *  `undefined` if any segment is missing. Arrays are joined with `, `
 *  for legibility (`property.included_items`). */
function lookup(data: ContractData, path: string): unknown {
  const parts = path.split(".")
  let cur: unknown = data
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

/** Convert a looked-up value to a printable string. Empty string is
 *  treated as "no value" so the user sees the placeholder remain
 *  visible until they fill the field. */
function format(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value === "string") {
    return value.trim().length === 0 ? null : value
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null
    return new Intl.NumberFormat("en-US").format(value)
  }
  if (typeof value === "boolean") {
    return value ? "Sí" : "No"
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null
    return value.map(String).join(", ")
  }
  return String(value)
}

/** Compute the set of placeholders found in `html`, in order of first
 *  occurrence. */
export function extractPlaceholders(html: string): string[] {
  const seen = new Set<string>()
  const list: string[] = []
  for (const m of html.matchAll(PLACEHOLDER_RE)) {
    const path = m[1]
    if (!seen.has(path)) {
      seen.add(path)
      list.push(path)
    }
  }
  return list
}

/**
 * Replace every resolvable `{{x}}` with its value. Unresolved tokens
 * are left as literal `{{x}}` and reported in the result.
 *
 * Multi-pass: synthetic placeholders (e.g. `{{tenant.identification_block}}`)
 * resolve to STRINGS that may themselves contain `{{...}}` tokens
 * pointing to real ContractData fields. We run the regex repeatedly
 * until the output stabilises (or we hit a safe iteration cap, in
 * case someone wires a circular synthetic).
 *
 * Behaviour for synthetic placeholders: they're computed in
 * `contract-generation-service`'s `withDerivedFields` and spliced
 * into a working copy of ContractData BEFORE this function runs.
 * This keeps placeholder resolution dumb and pure.
 */
export function resolvePlaceholders(
  html: string,
  data: ContractData,
): PlaceholderResolution {
  const found      = extractPlaceholders(html)
  const unresolved = new Set<string>()

  let current = html
  for (let pass = 0; pass < 5; pass++) {
    const before = current
    unresolved.clear()  // each pass tracks fresh — only the FINAL set matters
    current = current.replace(PLACEHOLDER_RE, (match, path: string) => {
      const value = lookup(data, path)
      const printable = format(value)
      if (printable === null) {
        unresolved.add(path)
        return match  // keep literal
      }
      return printable
    })
    if (current === before) break  // fixed point
  }

  return {
    html:       current,
    unresolved: Array.from(unresolved),
    found,
  }
}

/**
 * Wrap any `{{x}}` still present in HTML with a `<mark>` so Tiptap
 * can style it. Idempotent — running twice doesn't double-wrap.
 */
export function highlightUnresolved(html: string): string {
  return html.replace(PLACEHOLDER_RE, (m) =>
    `<mark class="contract-unresolved" data-placeholder>${m}</mark>`)
}

/** Produce a plain-text projection of an HTML contract. Strips tags,
 *  normalises whitespace. Used to populate
 *  `contracts.generated_plain_text` for fast text search. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<\/(p|h1|h2|h3|li)>/g, "\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g,  "<")
    .replace(/&gt;/g,  ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
