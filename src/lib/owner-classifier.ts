// Heuristic classifier — given the raw text + metadata of a crawled
// listing, scores how likely it is to be published directly by the
// property owner (vs. by an agency / broker).
//
// Why heuristics first: a deterministic pattern match is free, fast
// and predictable. We score and ship. If we ever want to refine the
// ambiguous middle (scores 35–65), we can run a small LLM pass — but
// for prospecting it's not required: the admin just calls everyone
// above 60 first.
//
// Returned score is on a 0–100 scale:
//   ≥ 70   → strong owner signal (call first)
//   40–69  → ambiguous (worth a quick look)
//   < 40   → likely agency / broker (deprioritise)

export interface OwnerClassification {
  /** 0–100 — how owner-published this listing looks. */
  score:   number
  /** "high" | "medium" | "low" — derived from `score` for badge UI. */
  tier:    "high" | "medium" | "low"
  /** Human-readable signals that pushed the score up or down. We show
   *  these as chips so the admin sees the model's reasoning. */
  signals: string[]
}

interface ClassifierInput {
  rawText?:     string
  title?:       string
  description?: string
  agentOrCompany?: string
  /** Optional enrichment from the detail-page step:
   *  • `advertiserRole`: "particular" | "professional" — the badge
   *    encuentra24 shows on the listing's right sidebar.
   *  • `advertiserTotalListings`: how many active listings exist on
   *    the advertiser's PROFILE page (across the whole portal).
   *    This is the highest-signal bit: an agent typically has 5+
   *    listings, an owner usually has 1.
   *  • `advertiserOccurrences`: soft fallback — how many listings
   *    in the SAME scan share this advertiser. Useful when the
   *    profile page didn't return a count. */
  advertiserRole?:           "particular" | "professional" | null
  advertiserTotalListings?:  number | null
  advertiserOccurrences?:    number
  advertiserName?:           string | null
}

// ── Pattern dictionaries ────────────────────────────────────────────
// Owner-positive phrases — written exactly as they appear on CR
// real-estate portals.
const OWNER_PHRASES: ReadonlyArray<{ pattern: RegExp; label: string; weight: number }> = [
  // Strong, unambiguous owner-published markers
  { pattern: /\bdue[ñn]o\s+directo\b/i,                     label: "Dueño directo",        weight: 40 },
  { pattern: /\bpor\s+due[ñn]o\b/i,                         label: "Por dueño",            weight: 35 },
  { pattern: /\btrato\s+directo\s+con\s+due[ñn]o\b/i,       label: "Trato directo dueño",  weight: 40 },
  { pattern: /\bsin\s+intermediarios?\b/i,                  label: "Sin intermediarios",   weight: 30 },
  { pattern: /\bsin\s+comisi[oó]n\b/i,                      label: "Sin comisión",         weight: 25 },
  { pattern: /\bparticulares?\b/i,                          label: "Particular",           weight: 25 },
  { pattern: /\bowner\s+(direct|listed|seller)\b/i,         label: "Owner direct",         weight: 30 },
  { pattern: /\bfor\s+sale\s+by\s+owner\b|\bfsbo\b/i,       label: "FSBO",                 weight: 35 },

  // First-person ownership claims — common in DIY listings
  { pattern: /\bvendo\s+mi\b/i,                             label: "“Vendo mi…”",          weight: 25 },
  { pattern: /\balquilo\s+mi\b/i,                           label: "“Alquilo mi…”",        weight: 25 },
  { pattern: /\b(mi|nuestra)\s+(casa|apartamento|propiedad|terreno|lote|finca)\b/i, label: "“Mi propiedad”", weight: 15 },
  { pattern: /\b(soy|somos)\s+(el\s+)?due[ñn]o(s)?\b/i,     label: "“Soy el dueño”",       weight: 30 },

  // Slightly weaker but still positive cues
  { pattern: /\bse\s+vende\s+por\s+motivo\b/i,              label: "Se vende por motivo",  weight: 15 },
  { pattern: /\bse\s+alquila\s+mi\b/i,                      label: "Se alquila mi…",       weight: 20 },
  { pattern: /\bpropietario\s+vende\b/i,                    label: "Propietario vende",    weight: 25 },
  { pattern: /\bcontacto\s+directo\s+con\s+propietario\b/i, label: "Contacto directo propietario", weight: 35 },
] as const

// Agency-negative phrases — when these appear, we subtract from the
// score. Real-estate agencies operating in CR + the most common
// international franchises.
const AGENCY_PHRASES: ReadonlyArray<{ pattern: RegExp; label: string; weight: number }> = [
  { pattern: /\b(re\/?max|remax)\b/i,                                           label: "RE/MAX",          weight: -40 },
  { pattern: /\bcentury\s*21\b/i,                                               label: "Century 21",      weight: -40 },
  { pattern: /\bcoldwell\s+banker\b/i,                                          label: "Coldwell Banker", weight: -40 },
  { pattern: /\bkeller\s+williams\b|\bkw\s+costa\s+rica\b/i,                    label: "Keller Williams", weight: -40 },
  { pattern: /\bsotheby[''']?s\b/i,                                             label: "Sotheby's",       weight: -40 },
  { pattern: /\bberkshire\s+hathaway\b/i,                                       label: "Berkshire H.",    weight: -40 },
  { pattern: /\bengel\s*&\s*v[oö]lkers\b/i,                                     label: "Engel & Völkers", weight: -40 },
  { pattern: /\binmobiliaria\b|\brealty\b|\brealtors?\b|\brealtor\b/i,          label: "Inmobiliaria",    weight: -30 },
  { pattern: /\bbroker(s|age)?\b/i,                                             label: "Broker",          weight: -25 },
  { pattern: /\bcorredor(a|es)?\s+(de\s+)?bienes\s+ra[ií]ces\b/i,               label: "Corredor BR",     weight: -30 },
  { pattern: /\bagente\s+inmobiliari[oa]\b|\basesor(a|es)?\s+inmobiliari[oa]\b/i, label: "Agente inmob.", weight: -25 },
  { pattern: /\bgrupo\s+inmobiliario\b|\bbienes\s+ra[ií]ces\s+s\.?a\.?\b/i,     label: "Grupo / S.A.",    weight: -25 },
  // Common CR brokerage names you'll see repeatedly — not exhaustive,
  // but each new hit improves precision. Easy to extend.
  { pattern: /\bcomprar\s+casa\s+cr\b|\bccr\s+real\s+estate\b/i,                label: "Marca local",     weight: -30 },
] as const

// ── Public API ─────────────────────────────────────────────────────
export function classifyOwner(input: ClassifierInput): OwnerClassification {
  const haystack = normalize([
    input.title ?? "",
    input.agentOrCompany ?? "",
    input.description ?? "",
    input.rawText ?? "",
  ].join("\n"))

  let score   = 50   // start neutral
  const signals: string[] = []

  // Apply owner-positive matches (deduplicate the label so we don't
  // double-count the same phrase appearing twice).
  const matched = new Set<string>()

  for (const { pattern, label, weight } of OWNER_PHRASES) {
    if (matched.has(label)) continue
    if (pattern.test(haystack)) {
      matched.add(label)
      score += weight
      signals.push(`+ ${label}`)
    }
  }
  for (const { pattern, label, weight } of AGENCY_PHRASES) {
    if (matched.has(label)) continue
    if (pattern.test(haystack)) {
      matched.add(label)
      score += weight    // weight is negative
      signals.push(`− ${label}`)
    }
  }

  // Heuristic: an `agent_or_company` field that's just a single first
  // name (no S.A., no "Inmobiliaria", no surname) is a weak owner cue.
  if (input.agentOrCompany) {
    const ac = input.agentOrCompany.trim()
    const tokens = ac.split(/\s+/).filter(Boolean)
    const hasCompanyMarker = /(s\.?a\.?|s\.?r\.?l\.?|ltda|inmobiliaria|realty|broker|group|grupo)/i.test(ac)
    if (!hasCompanyMarker && tokens.length === 1 && /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}$/.test(tokens[0])) {
      score += 10
      signals.push("+ Solo nombre de pila")
    }
  }

  // ── Detail-page enrichment (highest-confidence signals). ──────
  // The portal's own role badge beats anything we infer from text.
  if (input.advertiserRole === "particular") {
    score += 50
    signals.push("+ Etiqueta PARTICULAR")
  } else if (input.advertiserRole === "professional") {
    score -= 50
    signals.push("− Etiqueta PROFESIONAL")
  }

  // ── Profile-page total — the real signal. ─────────────────────
  // We followed the advertiser's profile URL and counted their total
  // active listings. Agents typically have many; owners usually have
  // 1 (sometimes 2 if they're selling and renting the same property).
  const total = input.advertiserTotalListings
  if (typeof total === "number") {
    if (total >= 10) {
      score -= 55
      signals.push(`− ${total} listados en el perfil`)
    } else if (total >= 5) {
      score -= 40
      signals.push(`− ${total} listados en el perfil`)
    } else if (total >= 3) {
      score -= 20
      signals.push(`− ${total} listados en el perfil`)
    } else if (total === 2) {
      score -= 5
      signals.push("− 2 listados en el perfil")
    } else if (total === 1) {
      score += 25
      signals.push("+ 1 listado en el perfil")
    }
  } else {
    // ── Soft fallback — in-scan repetition. ────────────────────
    // Only consulted when the profile-page count wasn't available
    // (network failure, layout we don't recognise). This used to be
    // the primary signal but it under-counts agents whose listings
    // didn't all fit in the current page of results.
    const occ = input.advertiserOccurrences ?? 0
    if (occ >= 4) {
      score -= 30
      signals.push(`− ${occ} en este scan`)
    } else if (occ === 3) {
      score -= 18
      signals.push("− 3 en este scan")
    } else if (occ === 2) {
      score -= 8
      signals.push("− 2 en este scan")
    }
  }

  // Clamp + tier
  score = Math.max(0, Math.min(100, Math.round(score)))
  const tier: OwnerClassification["tier"] =
    score >= 70 ? "high" : score >= 40 ? "medium" : "low"

  return { score, tier, signals }
}

// ── Helpers ────────────────────────────────────────────────────────
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // strip diacritics so "dueño" / "dueno" both match
    .replace(/\s+/g, " ")
    .trim()
}
