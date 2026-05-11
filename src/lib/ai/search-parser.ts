// Hybrid natural-language search parser for the marketplace.
//
// Pipeline:
//   1. Rule-based pass — fast, free, deterministic. Covers ~80 % of
//      everyday Spanish queries ("casa con jardín en escazú").
//   2. OpenAI fallback — only used when the rule-based pass found
//      nothing OR the user's query contains numerical/comparison
//      hints that rules can't reliably parse ("entre 200 mil y 500
//      mil dólares con vista al mar").
//
// Output is a `ParsedSearch` object that the marketplace page can
// directly turn into URL params.

import OpenAI from "openai"
import { ALL_SUBZONES, ALL_ZONES } from "@/lib/zones"

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export interface ParsedSearch {
  /** Free-text remainder — what didn't get extracted. Used as `?q=`. */
  q?:        string
  type?:     "apartment" | "house" | "land" | "commercial" | "office" | "warehouse"
  operation?: "sale" | "rent"
  furnished?: boolean
  bedrooms?:  number
  /** Single location string matched against `display_address ILIKE`. */
  location?:  string
  /** Inclusive bounds in USD. Either may be undefined. */
  price_min?: number
  price_max?: number
}

// ─────────────────────────────────────────────────────────────────
// Rule-based parser
// ─────────────────────────────────────────────────────────────────

const TYPE_PATTERNS: Array<{
  type: ParsedSearch["type"]
  rx:   RegExp
}> = [
  { type: "apartment",  rx: /\b(apartamento|apto|apt|departamento|depto|condo|condominio|piso)s?\b/i },
  { type: "house",      rx: /\b(casa|chalet|villa)s?\b/i },
  { type: "land",       rx: /\b(terreno|lote|finca|propiedad rural|tierra)s?\b/i },
  { type: "commercial", rx: /\b(local|comercial|comercio|tienda|restaurante)s?\b/i },
  { type: "office",     rx: /\b(oficina)s?\b/i },
  { type: "warehouse",  rx: /\b(bodega|warehouse|almac[eé]n)s?\b/i },
]

const OPERATION_PATTERNS: Array<{
  op: ParsedSearch["operation"]
  rx: RegExp
}> = [
  // rent first — "en alquiler" beats a generic "compra"
  { op: "rent", rx: /\b(alquiler|alquilar|rentar|renta|rent|arrendar|arriendo|en alquiler|para alquilar)\b/i },
  { op: "sale", rx: /\b(venta|vender|comprar|compra|en venta|para comprar)\b/i },
]

const FURNISHED_RX = /\b(amueblado|amueblada|amobl|con muebles|fully furnished|furnished)\b/i

const BEDROOMS_RX  = /\b(\d+)\s*(?:hab(?:itaci(?:o|ó)nes?)?|cuartos?|dormitorios?|recámaras?|aposentos?|bed(?:room)?s?|hab|hba)\b/i

// ── Price patterns (USD assumed) ─────────────────────────────────
//
// "hasta 300k" · "menos de 500 mil" · "<300000"
const PRICE_MAX_RX =
  /\b(?:hasta|maximo|m[aá]ximo|max|menos de|debajo de|under|<)\s*\$?\s*([\d.,]+)\s*(k|mil|m|millones?|million)?\b/i

// "desde 200k" · "más de 100 mil" · ">200000"
const PRICE_MIN_RX =
  /\b(?:desde|m[aá]s de|mayor a|over|above|>)\s*\$?\s*([\d.,]+)\s*(k|mil|m|millones?|million)?\b/i

// "entre 200k y 500k" · "200 a 500 mil"
const PRICE_RANGE_RX =
  /\b(?:entre|between)?\s*\$?\s*([\d.,]+)\s*(k|mil|m|millones?|million)?\s*(?:y|a|to|-|–)\s*\$?\s*([\d.,]+)\s*(k|mil|m|millones?|million)?\b/i

function normaliseAmount(num: string, unit?: string): number {
  const n = Number(num.replace(/[.,](?=\d{3}\b)/g, "").replace(",", "."))
  if (!Number.isFinite(n)) return NaN
  switch ((unit ?? "").toLowerCase()) {
    case "k":
    case "mil":
      return n * 1_000
    case "m":
    case "millon":
    case "millón":
    case "millones":
    case "million":
      return n * 1_000_000
    default:
      return n
  }
}

/** Match the longest known location label that appears in the query. */
function matchLocation(query: string): string | undefined {
  const lower = query.toLowerCase()
  // Try subzone labels first (more specific), then zone short labels.
  const candidates: { label: string; len: number }[] = []
  for (const sz of ALL_SUBZONES) {
    if (lower.includes(sz.label.toLowerCase())) {
      candidates.push({ label: sz.label, len: sz.label.length })
    }
  }
  for (const z of ALL_ZONES) {
    if (lower.includes(z.shortLabel.toLowerCase()) ||
        lower.includes(z.label.toLowerCase())) {
      candidates.push({ label: z.shortLabel, len: z.shortLabel.length })
    }
  }
  candidates.sort((a, b) => b.len - a.len)
  return candidates[0]?.label
}

/** Strip a regex match (or list of segments) from the query, returning the leftover free text. */
function stripMatches(query: string, matches: (string | RegExp | undefined)[]): string {
  let out = query
  for (const m of matches) {
    if (!m) continue
    if (typeof m === "string") {
      out = out.replace(new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ")
    } else {
      out = out.replace(m, " ")
    }
  }
  return out.replace(/\s+/g, " ").trim()
}

function parseRules(input: string): { parsed: ParsedSearch; remaining: string } {
  const parsed: ParsedSearch = {}
  const consumedBits: string[] = []
  let working = input

  // Type
  for (const { type, rx } of TYPE_PATTERNS) {
    const m = working.match(rx)
    if (m) {
      parsed.type = type
      consumedBits.push(m[0])
      working = working.replace(rx, " ")
      break
    }
  }

  // Operation
  for (const { op, rx } of OPERATION_PATTERNS) {
    const m = working.match(rx)
    if (m) {
      parsed.operation = op
      consumedBits.push(m[0])
      working = working.replace(rx, " ")
      break
    }
  }

  // Furnished — only meaningful if no operation was extracted as 'sale'
  if (FURNISHED_RX.test(working)) {
    parsed.furnished = true
    if (!parsed.operation) parsed.operation = "rent"  // implicit: amueblado → rental
    const m = working.match(FURNISHED_RX)
    if (m) consumedBits.push(m[0])
    working = working.replace(FURNISHED_RX, " ")
  }

  // Bedrooms
  const bedM = working.match(BEDROOMS_RX)
  if (bedM) {
    const n = Number(bedM[1])
    if (Number.isFinite(n) && n > 0 && n < 20) parsed.bedrooms = n
    consumedBits.push(bedM[0])
    working = working.replace(BEDROOMS_RX, " ")
  }

  // Price — try range first, then min, then max
  const rangeM = working.match(PRICE_RANGE_RX)
  if (rangeM) {
    const lo = normaliseAmount(rangeM[1], rangeM[2])
    const hi = normaliseAmount(rangeM[3], rangeM[4])
    if (Number.isFinite(lo)) parsed.price_min = lo
    if (Number.isFinite(hi)) parsed.price_max = hi
    consumedBits.push(rangeM[0])
    working = working.replace(PRICE_RANGE_RX, " ")
  } else {
    const minM = working.match(PRICE_MIN_RX)
    if (minM) {
      const v = normaliseAmount(minM[1], minM[2])
      if (Number.isFinite(v)) parsed.price_min = v
      consumedBits.push(minM[0])
      working = working.replace(PRICE_MIN_RX, " ")
    }
    const maxM = working.match(PRICE_MAX_RX)
    if (maxM) {
      const v = normaliseAmount(maxM[1], maxM[2])
      if (Number.isFinite(v)) parsed.price_max = v
      consumedBits.push(maxM[0])
      working = working.replace(PRICE_MAX_RX, " ")
    }
  }

  // Location — match LAST so price/bed phrasing doesn't accidentally
  // capture city names (e.g. "1500 sur" — the "1500" is gone first)
  const loc = matchLocation(working)
  if (loc) {
    parsed.location = loc
    working = working.replace(new RegExp(loc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ")
  }

  // Anything left that isn't a stop-word becomes the free-text query
  const remaining = stripMatches(working, [/\b(en|de|con|por|para|y|o|el|la|los|las|un|una)\b/gi])
    .replace(/\s+/g, " ")
    .trim()

  return { parsed, remaining }
}

// ─────────────────────────────────────────────────────────────────
// LLM fallback
// ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a search query parser for a Costa Rica real-estate marketplace.

The user types a free-form Spanish query. Extract structured filters from it.
Return ONLY a JSON object that matches the schema, no prose.

Rules:
- "operation" is "sale" if the user wants to BUY (compra/venta), "rent" if they want to RENT (alquiler/rentar). Omit if unclear.
- "type" is one of: apartment, house, land, commercial, office, warehouse
- "bedrooms" is the *minimum* number requested (e.g. "3 habitaciones" → 3)
- "furnished" is true only if explicitly mentioned. If the user says "amueblado" assume operation = rent.
- "location" must be a Costa Rica neighborhood, city or zone (e.g. "Escazú", "Tamarindo", "Curridabat"). Otherwise omit.
- "price_min" / "price_max" in USD. "300k" = 300000. "1.5M" = 1500000. Most CR prices are in USD.
- "q" is the *leftover* free-text describing things you couldn't put in another field (e.g. "con vista al mar", "con piscina"). Trim stopwords.
- Omit fields with no signal — do NOT invent values.`

interface OpenAIClientLike {
  chat: {
    completions: {
      create(args: Parameters<OpenAI["chat"]["completions"]["create"]>[0]): Promise<unknown>
    }
  }
}

let _client: OpenAI | null = null
function getClient(): OpenAIClientLike | null {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null
  if (_client) return _client
  _client = new OpenAI({ apiKey: key })
  return _client
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    q:         { type: ["string", "null"] },
    type:      { type: ["string", "null"], enum: ["apartment", "house", "land", "commercial", "office", "warehouse", null] },
    operation: { type: ["string", "null"], enum: ["sale", "rent", null] },
    furnished: { type: ["boolean", "null"] },
    bedrooms:  { type: ["integer", "null"] },
    location:  { type: ["string", "null"] },
    price_min: { type: ["number", "null"] },
    price_max: { type: ["number", "null"] },
  },
  required: ["q", "type", "operation", "furnished", "bedrooms", "location", "price_min", "price_max"],
} as const

async function parseLLM(input: string): Promise<ParsedSearch | null> {
  const client = getClient()
  if (!client) return null
  try {
    const res = await client.chat.completions.create({
      model:       "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: input },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "search_filters", schema: SCHEMA, strict: true },
      },
    }) as { choices: { message: { content: string | null } }[] }

    const text = res.choices[0]?.message?.content
    if (!text) return null
    const raw = JSON.parse(text) as Record<string, unknown>

    // Strip nulls — the schema returns explicit nulls for unmatched fields
    const out: ParsedSearch = {}
    if (typeof raw.q         === "string"  && raw.q.trim())  out.q         = raw.q.trim()
    if (typeof raw.type      === "string")                   out.type      = raw.type as ParsedSearch["type"]
    if (typeof raw.operation === "string")                   out.operation = raw.operation as ParsedSearch["operation"]
    if (typeof raw.furnished === "boolean")                  out.furnished = raw.furnished
    if (typeof raw.bedrooms  === "number"  && raw.bedrooms > 0) out.bedrooms  = Math.floor(raw.bedrooms)
    if (typeof raw.location  === "string"  && raw.location.trim()) out.location = raw.location.trim()
    if (typeof raw.price_min === "number"  && raw.price_min >= 0)  out.price_min = raw.price_min
    if (typeof raw.price_max === "number"  && raw.price_max >  0)  out.price_max = raw.price_max
    return out
  } catch {
    // Network / parsing failure → fall back to whatever rules gave us
    return null
  }
}

// ─────────────────────────────────────────────────────────────────
// Public entry — combines both passes
// ─────────────────────────────────────────────────────────────────

/**
 * Parse a free-form search query into structured marketplace filters.
 *
 * The rule-based pass runs synchronously and handles the common case.
 * The LLM is consulted ONLY when:
 *   - rules extracted nothing, OR
 *   - the query is reasonably long (>40 chars — likely contains hints
 *     rules don't cover, like "con vista al mar")
 *
 * Either pass can fail open: if both yield nothing the original
 * query becomes the `q` free-text param.
 */
export async function parseSearchQuery(input: string): Promise<ParsedSearch> {
  const trimmed = input.trim()
  if (!trimmed) return {}

  const { parsed, remaining } = parseRules(trimmed)
  const ruleHits = Object.keys(parsed).length
  const looksComplex = trimmed.length > 40 || /\b(con|cerca|vista|piscina|jard[íi]n|playa|monta|amplio|nuevo|moderno)\b/i.test(trimmed)

  // If rules covered enough of the query and there's no extra complexity,
  // skip the LLM call.
  if (ruleHits >= 2 && !looksComplex) {
    return remaining ? { ...parsed, q: remaining } : parsed
  }

  // LLM pass — merges with whatever the rules already found, with the
  // LLM filling in the gaps but never overriding an explicit rule hit.
  const llm = await parseLLM(trimmed)
  if (!llm) {
    return remaining ? { ...parsed, q: remaining } : parsed
  }

  const merged: ParsedSearch = { ...llm, ...parsed }   // rules win for non-q fields
  // For `q` specifically: prefer the rule-pass `remaining` (which has
  // already had recognised tokens like "oficina" stripped) over the
  // LLM's `q` (which sometimes echoes the original query verbatim).
  // Only fall back to the LLM's `q` when rules consumed everything
  // and there's no remaining text.
  if (remaining)      merged.q = remaining
  else if (llm.q)     merged.q = llm.q
  else                delete merged.q
  return merged
}
