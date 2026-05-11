// LLM-powered similarity fallback for the marketplace.
//
// When all the rule-based tiers (strict → broad → broadest) return
// zero matches, this module asks `gpt-4o-mini` to read the user's
// natural-language query alongside a candidate set of marketplace
// properties and pick the ones that best match the *intent*, even
// when the literal keywords don't line up.
//
// Example: query "oficina en lima" with no office in Lima → the LLM
// might surface a commercial unit in San José that could function as
// an office.

import OpenAI from "openai"

export interface RankCandidate {
  id:              string
  title:           string | null
  description:     string | null
  property_type:   string | null
  listing_type:    string | null
  display_address: string | null
  bedrooms:        number | null
  bathrooms:       number | null
  area_sqm:        number | null
  price:           number | null
  currency:        string | null
}

let _client: OpenAI | null = null
function getClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null
  if (_client) return _client
  _client = new OpenAI({ apiKey: key })
  return _client
}

const SYSTEM_PROMPT = `You are a real-estate search assistant for a Costa Rica marketplace.

The user couldn't find a literal match for what they typed. You are given the
original query plus a candidate set of available listings. Pick the listings
most likely to satisfy the user's intent.

Use these signals (in order of priority):
1. **Property type & operation** — must usually match (a renter wants rentals).
2. **Geographic proximity** — if the user wants a zone with no inventory,
   suggest neighboring zones. Costa Rica neighborhoods that are commonly
   substituted for one another:
   - Escazú ↔ Santa Ana ↔ Lindora ↔ Pozos (GAM Oeste cluster)
   - Sabana ↔ Rohrmoser ↔ Pavas ↔ Mata Redonda (centre-west)
   - Curridabat ↔ Tres Ríos ↔ Sabanilla ↔ San Pedro (GAM Este cluster)
   - Heredia ↔ Belén ↔ San Antonio (GAM Norte cluster)
   - Tamarindo ↔ Flamingo ↔ Conchal ↔ Brasilito (Costa Dorada)
   - Playas del Coco ↔ Hermosa ↔ Ocotal ↔ Liberia (Guanacaste Norte)
   - Jacó ↔ Herradura ↔ Hermosa de Garabito (Pacífico Central)
   - Manuel Antonio ↔ Quepos
   - Dominical ↔ Uvita ↔ Ojochal
3. **Specs** — bedrooms, bathrooms, area as soft signals.
4. **Price/budget** — stay close to user's range when stated.

Reasoning should be 1-2 short Spanish sentences explaining WHY these listings
match the intent (e.g. "No encontramos casas en Escazú, pero te mostramos
opciones en Santa Ana y Sabana que están a 5-10 minutos.").

Return ONLY a JSON object with the schema. Order ids by relevance (best first).
If a listing is clearly irrelevant, omit it. Aim for 6-12 results unless the
candidate set is smaller.`

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    ids: {
      type: "array",
      items: { type: "string" },
    },
    reasoning: { type: "string" },
  },
  required: ["ids", "reasoning"],
} as const

/**
 * Compact candidate description — keeps the LLM context tight.
 * 30-50 properties × ~50 tokens = ~2k tokens of input.
 */
function describeCandidate(c: RankCandidate, idx: number): string {
  const parts = [
    `[${idx}] ${c.id}`,
    c.title?.trim(),
    c.property_type && c.listing_type ? `${c.property_type} (${c.listing_type})` : c.property_type,
    c.display_address?.trim(),
    c.price != null && c.currency ? `${c.currency} ${c.price.toLocaleString("en-US")}` : null,
    c.bedrooms != null ? `${c.bedrooms} hab` : null,
    c.bathrooms != null ? `${c.bathrooms} bath` : null,
    c.area_sqm != null ? `${c.area_sqm} m²` : null,
  ].filter(Boolean)
  return parts.join(" · ")
}

/** Maximum candidates we send to the LLM in a single call. */
const MAX_LLM_CANDIDATES = 120

/**
 * Ask the LLM to rank a candidate set against the user's query.
 * Returns property IDs in relevance order. Empty array on any failure
 * — the caller MUST handle that as a graceful no-op (i.e. show
 * whatever it had before).
 *
 * **Scaling note**: this approach (send-all-to-LLM) is fine while the
 * marketplace stays under ~1k listings. Beyond that we'd want
 * pgvector embeddings as a coarse pre-filter — embed the query +
 * each property description, ANN-search top-K, then LLM-rank only
 * the survivors. For now the caller pre-filters to a relevant
 * candidate set so we rarely hit the cap.
 */
export async function rankPropertiesByRelevance(
  query:      string,
  candidates: RankCandidate[],
  topK     = 12,
): Promise<{ ids: string[]; reasoning: string } | null> {
  const client = getClient()
  if (!client) return null
  if (candidates.length === 0) return null

  // Cap input so we don't blow the context window. The caller is
  // expected to pre-filter so this almost never trims meaningful
  // signal — but we hard-cap defensively.
  const sample = candidates.slice(0, MAX_LLM_CANDIDATES)

  const userMsg = [
    `User query: "${query}"`,
    "",
    "Candidates:",
    ...sample.map(describeCandidate),
    "",
    `Return up to ${topK} ids ordered by relevance.`,
  ].join("\n")

  try {
    const res = await client.chat.completions.create({
      model:       "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userMsg },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "ranked_results", schema: SCHEMA, strict: true },
      },
    }) as { choices: { message: { content: string | null } }[] }

    const text = res.choices[0]?.message?.content
    if (!text) return null
    const raw = JSON.parse(text) as { ids?: unknown; reasoning?: unknown }

    // Validate + filter to known IDs (the LLM occasionally hallucinates).
    const known    = new Set(candidates.map((c) => c.id))
    const ids      = Array.isArray(raw.ids)
      ? raw.ids.filter((x): x is string => typeof x === "string" && known.has(x))
      : []
    const reasoning = typeof raw.reasoning === "string" ? raw.reasoning : ""

    if (ids.length === 0) return null
    return { ids: ids.slice(0, topK), reasoning }
  } catch {
    return null
  }
}
