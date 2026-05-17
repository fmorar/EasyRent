import "server-only"
import { z } from "zod"
import { updateLeadFromAgent } from "@/lib/actions/whatsapp-lead.actions"
import { searchPropertiesForAgent, getPropertyDetailsForAgent } from "./property-search"
import type { AgentContext } from "./state"

/**
 * Tool registry for the WhatsApp concierge agent.
 *
 * Each entry has two pieces:
 *   1. `definition` — the JSON Schema the OpenAI Responses API needs
 *      to know the function exists + how to call it.
 *   2. `execute`  — the server-side handler. Receives validated args
 *      (Zod) + the per-turn `AgentContext` (lead id, conversation
 *      id) injected by the runner. The model NEVER passes lead id /
 *      conversation id — the runner does, so the agent can't ever
 *      reach into another lead's data even by mistake.
 *
 * Naming + shape conventions:
 *   • snake_case, verb-first names (matches the function-calling
 *     idiom from OpenAI's docs).
 *   • Args validated server-side; on validation failure we surface
 *     the error back to the model as JSON `{ ok: false, error }`
 *     instead of throwing — the model can self-correct on the next
 *     iteration.
 *   • Outputs are always JSON-serializable plain objects. Dates as
 *     ISO strings, never `Date`.
 */

// ──────────────────────────────────────────────────────────────────
// Zod schemas — single source of truth for the JSON Schema we hand
// to the API. We compile to JSON Schema via z.toJSONSchema() at
// definition time.
// ──────────────────────────────────────────────────────────────────

const UpdateLeadProfileSchema = z.object({
  full_name:        z.string().min(1).max(120).optional()
    .describe("Lead's full name as they told us. Only pass when the lead actually said their name."),
  email:            z.string().email().optional()
    .describe("Lead's email if they shared it. Don't ask for email — only set when volunteered."),
  inquiry_type:     z.enum(["availability", "visit", "info"]).optional()
    .describe("availability = pregunta si está disponible; visit = quiere coordinar visita; info = pregunta general."),
  move_in_window:   z.enum(["immediate", "one_month", "one_to_three_months", "three_to_six_months", "browsing"]).optional()
    .describe("When the lead wants to move."),
  budget_range:     z.enum(["under_1000", "between_1000_1500", "between_1500_2000", "between_2000_3000", "above_3000"]).optional()
    .describe("Approximate monthly rent or sale budget bucket in USD-equivalent."),
  has_pets:         z.enum(["none", "small_dog", "large_dog", "cat", "multiple"]).optional(),
  party_size:       z.number().int().min(1).max(20).optional()
    .describe("How many people will live in the unit."),
  preferred_zones:  z.array(z.string().min(1).max(80)).max(8).optional()
    .describe("Free-form Costa Rican zones the lead mentioned (e.g. ['Escazú', 'Santa Ana']). Replace, don't append."),
})

const SearchPropertiesSchema = z.object({
  listing_type:  z.enum(["rent", "sale"]).optional(),
  property_type: z.enum(["apartment", "house", "land", "commercial", "office", "warehouse"]).optional(),
  min_bedrooms:  z.number().int().min(0).max(20).optional(),
  max_bedrooms:  z.number().int().min(0).max(20).optional(),
  min_price:     z.number().min(0).optional(),
  max_price:     z.number().min(0).optional(),
  currency:      z.enum(["USD", "CRC"]).optional(),
  zones:         z.array(z.string().min(1).max(80)).max(5).optional()
    .describe("Free-form Costa Rican zones, e.g. ['Escazú', 'Santa Ana']."),
  furnished:     z.boolean().optional(),
  free_text:     z.string().max(200).optional()
    .describe("Optional free-text hint for LLM re-rank (e.g. 'cerca del parque', 'amueblado con piscina')."),
  limit:         z.number().int().min(1).max(10).optional(),
})

const GetPropertyDetailsSchema = z.object({
  slug: z.string().min(1).max(180).describe("Property slug as returned by search_properties."),
})

// ──────────────────────────────────────────────────────────────────
// Tool definitions for the OpenAI Responses API.
// Shape: `{ type: 'function', name, description, parameters }`
// (Responses API tools live at the top level, not nested under
// `function:` like the older Chat Completions tools.)
// ──────────────────────────────────────────────────────────────────

export interface ToolDefinition {
  type:        "function"
  name:        string
  description: string
  parameters:  Record<string, unknown>
  strict?:     boolean
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type:        "function",
    name:        "update_lead_profile",
    description:
      "Save data the lead just told us about themselves. Call this every time the lead reveals a name, email, intent, budget, zone, move-in timing, pets, or party size. Only pass fields the lead actually mentioned — don't fabricate.",
    parameters:  zodToJsonSchema(UpdateLeadProfileSchema),
  },
  {
    type:        "function",
    name:        "search_properties",
    description:
      "Search the easyrent marketplace for properties that match the lead's filters. Call this once you have at least 2 of (listing_type, zones, max_price). Returns up to 6 properties. NEVER invent properties — only present what this returns.",
    parameters:  zodToJsonSchema(SearchPropertiesSchema),
  },
  {
    type:        "function",
    name:        "get_property_details",
    description:
      "Get full details (description, amenities, photos) for ONE property by slug. Use only when the lead asks about a specific property already mentioned. NEVER fabricate details that aren't returned.",
    parameters:  zodToJsonSchema(GetPropertyDetailsSchema),
  },
]

// ──────────────────────────────────────────────────────────────────
// Executors. Each takes (rawArgs, context) → JSON result that gets
// fed back to the model.
// ──────────────────────────────────────────────────────────────────

export interface ToolResult {
  ok:    boolean
  data?: unknown
  error?: string
}

export async function executeTool(
  name:    string,
  rawArgs: unknown,
  ctx:     AgentContext,
): Promise<ToolResult> {
  try {
    switch (name) {
      case "update_lead_profile": {
        const args = UpdateLeadProfileSchema.parse(rawArgs)
        const res  = await updateLeadFromAgent({ leadId: ctx.lead.id, patch: args })
        return { ok: true, data: { updated_fields: res.updated } }
      }
      case "search_properties": {
        const args = SearchPropertiesSchema.parse(rawArgs)
        const rows = await searchPropertiesForAgent(args)
        return {
          ok: true,
          data: {
            count: rows.length,
            // Trim to what the agent actually needs in-prompt — keep
            // tokens lean. Detail tool returns more on demand.
            results: rows.map((r) => ({
              slug:           r.slug,
              title:          r.title,
              price:          r.price,
              currency:       r.currency,
              listing_type:   r.listing_type,
              property_type:  r.property_type,
              bedrooms:       r.bedrooms,
              bathrooms:      r.bathrooms,
              area_sqm:       r.area_sqm,
              display_address: r.display_address,
              url:            r.url,
            })),
          },
        }
      }
      case "get_property_details": {
        const args = GetPropertyDetailsSchema.parse(rawArgs)
        const detail = await getPropertyDetailsForAgent(args.slug)
        if (!detail) {
          return { ok: false, error: `Property with slug "${args.slug}" not found in the marketplace.` }
        }
        return { ok: true, data: detail }
      }
      default:
        return { ok: false, error: `Unknown tool: ${name}` }
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      // Surface validation errors so the model can self-correct.
      // Joined as a single readable string — easier for the model to
      // parse than a deep error tree.
      return {
        ok:    false,
        error: `Argument validation failed: ${err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      }
    }
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[whatsapp-agent.tools] ${name} failed`, msg)
    return { ok: false, error: msg }
  }
}

// ──────────────────────────────────────────────────────────────────
// Zod → JSON Schema helper.
// OpenAI's Responses API expects JSON Schema draft 2020-12-ish. Zod
// v4 ships a converter that produces it directly; we strip a couple
// of fields the OpenAI side doesn't like (`$schema` root, `additionalProperties`
// on every nested object — strict mode handles that).
// ──────────────────────────────────────────────────────────────────

function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const raw = z.toJSONSchema(schema, { target: "openapi-3.0" }) as Record<string, unknown>
  // Strip Zod's `$schema` field — OpenAI rejects it on tool params.
  delete raw["$schema"]
  return raw
}
