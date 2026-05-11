import OpenAI from "openai"

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── Property context passed to the AI ────────────────────────────
export interface DescriptionContext {
  title?:                string | null
  property_type?:        string | null
  status?:               string | null
  price?:                number | null
  currency?:             string | null
  public_address?:       string | null
  exact_address?:        string | null
  bedrooms?:             number | null
  bathrooms?:            number | null
  area_sqm?:             number | null
  floor?:                number | null
  parking_spaces?:       number | null
  amenities?:            string[] | null // building / property amenities (free-form)
  current_description?:  string | null   // existing text in the target language (may be plain or HTML)
  source_description?:   string | null   // Spanish original — used as reference when writing in English
  locale?:               string          // "es" (default) | "en"
}

// ── Type labels (Spanish) ─────────────────────────────────────────
const TYPE_ES: Record<string, string> = {
  apartment:  "Apartamento",
  house:      "Casa",
  land:       "Terreno",
  commercial: "Local comercial",
  office:     "Oficina",
  warehouse:  "Bodega",
}

const STATUS_ES: Record<string, string> = {
  available:  "En venta",
  reserved:   "Reservado",
  sold:       "Vendido",
  off_market: "Fuera de mercado",
  rented:     "En alquiler",
}

// ── System prompts ────────────────────────────────────────────────
// Informed by best practices from Sotheby's, Christie's, Engel & Völkers
// and NAR copywriting guidelines for Latin American markets.

const SHARED_PRINCIPLES = `
PRINCIPLES YOU FOLLOW:
1. Open with the single strongest emotional hook — the #1 reason someone would want to live/invest here.
2. Use sensory, specific language. Not "nice floors" → "polished porcelain floors"; not "large windows" → "floor-to-ceiling windows that flood the space with natural light".
3. Sell the lifestyle, not just the square meters. Who is the ideal buyer and how would their life look here?
4. Adapt tone to property type and price point:
   - Land / commercial → investment, potential, capital appreciation
   - Mid-range homes → family, comfort, everyday quality of life
   - Premium apartments / offices → exclusivity, productivity, design
5. For Latin American markets: highlight security features, natural light and cross-ventilation, proximity to malls/universities/airport/major roads. If in a gated community or condominio, mention it.
6. Narrative structure:
   - Paragraph 1: emotional hook (1-2 sentences)
   - Paragraph 2: standout interior features
   - Paragraph 3: practical details (bedrooms, bathrooms, parking, floor)
   - Paragraph 4 (if applicable): surroundings, location, access
   - Key highlights bullet list at the end (3-5 concise items with <ul><li>)
7. Short paragraphs: max 2-3 sentences each. Easy to scan.
8. BANNED words/phrases: "cozy", "charming", "must see", "unique opportunity", "priced to sell", "motivated seller", "turnkey", "move-in ready" (clichés that damage credibility).
9. Use <strong> to emphasize key data points (area, bedroom count, location name).
10. If existing description is provided, use it as context but substantially improve it.

OUTPUT: Valid HTML only. Allowed tags: <p> <strong> <em> <ul> <li>. No markdown, no text outside the HTML.
LENGTH: 160-280 words. Concise but compelling.`

const SYSTEM_PROMPT_ES = `You are the world's best real estate copywriter. You have written descriptions for properties at Sotheby's International Realty, Christie's Real Estate, and Engel & Völkers across Latin America. Your writing converts listings into sales because it emotionally connects the ideal buyer to the property before they ever step inside.
${SHARED_PRINCIPLES}
LANGUAGE: Spanish. Professional and aspirational tone.`

const SYSTEM_PROMPT_EN = `You are the world's best real estate copywriter. You have written descriptions for properties at Sotheby's International Realty, Christie's Real Estate, and Engel & Völkers across Latin America and internationally. Your writing converts listings into sales because it emotionally connects the ideal buyer to the property before they ever step inside.
${SHARED_PRINCIPLES}
LANGUAGE: English. Professional, aspirational tone suited for an international audience browsing Latin American real estate.`

// ── User prompt builder ───────────────────────────────────────────
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

function buildUserPrompt(ctx: DescriptionContext): string {
  const isEn = ctx.locale === "en"
  const lines: string[] = ["Property data:"]

  if (ctx.title)          lines.push(`- Title: ${ctx.title}`)
  if (ctx.property_type)  lines.push(`- Type: ${TYPE_ES[ctx.property_type] ?? ctx.property_type}`)
  if (ctx.status)         lines.push(`- Status: ${STATUS_ES[ctx.status] ?? ctx.status}`)

  if (ctx.price != null && ctx.currency)
    lines.push(`- Price: ${ctx.price.toLocaleString()} ${ctx.currency}`)

  if (ctx.exact_address ?? ctx.public_address)
    lines.push(`- Location: ${ctx.exact_address ?? ctx.public_address}`)

  if (ctx.area_sqm != null)       lines.push(`- Area: ${ctx.area_sqm} m²`)
  if (ctx.bedrooms != null)       lines.push(`- Bedrooms: ${ctx.bedrooms}`)
  if (ctx.bathrooms != null)      lines.push(`- Bathrooms: ${ctx.bathrooms}`)
  if (ctx.floor != null)          lines.push(`- Floor: ${ctx.floor}`)
  if (ctx.parking_spaces != null) lines.push(`- Parking spaces: ${ctx.parking_spaces}`)

  if (ctx.amenities && ctx.amenities.length > 0) {
    lines.push(`- Amenities (must mention the most relevant ones naturally — do NOT just list them all): ${ctx.amenities.join(", ")}`)
  }

  // For English rewrites, provide the Spanish original as reference
  if (isEn && ctx.source_description?.trim()) {
    const plain = stripHtml(ctx.source_description)
    lines.push(`\nSpanish original description (use as factual reference, do NOT translate directly):\n"${plain}"`)
  }

  if (ctx.current_description?.trim()) {
    const plain = stripHtml(ctx.current_description)
    const lang  = isEn ? "English" : "Spanish"
    lines.push(`\nExisting ${lang} description (improve substantially):\n"${plain}"`)
  } else {
    lines.push("\n(No existing description — write from scratch.)")
  }

  lines.push("\nWrite the optimized HTML description:")
  return lines.join("\n")
}

// ── Main function ─────────────────────────────────────────────────
export async function rewriteDescription(ctx: DescriptionContext): Promise<string> {
  const systemPrompt = ctx.locale === "en" ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_ES

  const response = await client.chat.completions.create({
    model:       "gpt-4o",
    temperature: 0.7,
    max_tokens:  800,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: buildUserPrompt(ctx) },
    ],
  })

  const html = response.choices[0]?.message?.content?.trim()
  if (!html) throw new Error("OpenAI returned empty response")

  // Strip any accidental markdown code fences
  return html.replace(/^```html?\n?/, "").replace(/\n?```$/, "").trim()
}
