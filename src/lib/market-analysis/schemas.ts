// ============================================================
// Market Analysis — Zod schemas
//
// Validates form input and OpenAI structured outputs. Every
// boundary into the pipeline uses one of these schemas.
// ============================================================

import { z } from "zod"

// ── Form input: create a new report ──────────────────────────────
export const CreateMarketReportSchema = z.object({
  property_id:     z.string().uuid(),
  report_type:     z.enum(["sale", "rent"]),
  report_locale:   z.enum(["es", "en"]).default("es"),
  source_urls:     z.array(z.string().url()).min(1).max(10),
  scan_depth:      z.number().int().min(1).max(10).default(3),
  max_listings:    z.number().int().min(10).max(300).default(60),
  filters: z.object({
    matchOperationType:     z.boolean().default(true),
    matchPropertyType:      z.boolean().default(true),
    prioritizeSameCanton:   z.boolean().default(true),
    prioritizeSameDistrict: z.boolean().default(false),
    excludeWithoutPrice:    z.boolean().default(true),
    excludeOutliers:        z.boolean().default(true),
    excludeWithoutArea:     z.boolean().default(false),
    nearbyZones:            z.array(z.string()).optional(),
    minArea:                z.number().positive().optional(),
    maxArea:                z.number().positive().optional(),
    minPrice:               z.number().positive().optional(),
    maxPrice:               z.number().positive().optional(),
    bedroomsTolerance:      z.number().int().min(0).max(5).optional(),
    bathroomsTolerance:     z.number().int().min(0).max(5).optional(),
  }).default({
    matchOperationType:     true,
    matchPropertyType:      true,
    prioritizeSameCanton:   true,
    prioritizeSameDistrict: false,
    excludeWithoutPrice:    true,
    excludeOutliers:        true,
    excludeWithoutArea:     false,
  }),
})

export type CreateMarketReportInput = z.infer<typeof CreateMarketReportSchema>

// ── OpenAI structured output ─────────────────────────────────────
export const OpenAIMarketReportSchema = z.object({
  executive_summary:          z.string().min(10),
  recommended_price:          z.number().nonnegative(),
  recommended_price_min:      z.number().nonnegative(),
  recommended_price_max:      z.number().nonnegative(),
  currency:                   z.enum(["USD", "CRC"]),
  confidence_label:           z.enum(["Low", "Medium", "High"]),
  confidence_explanation:     z.string().min(5),
  market_position:            z.string().min(5),
  pricing_rationale:          z.string().min(5),
  owner_friendly_explanation: z.string().min(5),
  competitive_summary:        z.string().min(5),
  location_insights:          z.string(),
  amenities_insights:         z.string(),
  risks:                      z.array(z.string()),
  opportunities:              z.array(z.string()),
  suggested_listing_strategy: z.object({
    initial_listing_price:  z.number().nonnegative(),
    negotiation_floor:      z.number().nonnegative(),
    review_after_days:      z.number().int().positive(),
    strategy_explanation:   z.string(),
  }),
  pricing_scenarios: z.object({
    aggressive:   z.object({ price: z.number().nonnegative(), description: z.string() }),
    balanced:     z.object({ price: z.number().nonnegative(), description: z.string() }),
    aspirational: z.object({ price: z.number().nonnegative(), description: z.string() }),
  }),
  methodology:                z.string().min(5),
  limitations:                z.array(z.string()),
  disclaimer:                 z.string().min(5),
  // Site analysis is injected by the pipeline after AI validation;
  // we keep it permissive here so the schema accepts whatever the
  // service produces. The AI never authors this — only the engine.
  site_analysis:              z.unknown().optional().nullable(),
})

export type OpenAIMarketReportOutput = z.infer<typeof OpenAIMarketReportSchema>
