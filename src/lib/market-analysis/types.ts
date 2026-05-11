// ============================================================
// Market Analysis — shared internal types
//
// These types travel through the pipeline:
//   crawler → normalizer → location/fx/amenities → filter
//   → similarity → pricing engine → openai → persistence
//
// They mirror DB row shapes loosely but exist independently so
// the in-memory pipeline doesn't depend on Supabase types.
// ============================================================

import type { MarketReportType } from "@/types"
import type { SiteAnalysis } from "./site-analysis-service"

// ── Crawler I/O ──────────────────────────────────────────────────
export interface CrawlListingInput {
  url:         string
  scanDepth:   number
  maxListings: number
  userAgent:   string
}

export interface CrawlDetailInput {
  url:       string
  userAgent: string
}

/**
 * Raw output from a crawler adapter. Strings/numbers are best-effort
 * — the normalizer is responsible for sanitizing them.
 */
export interface CrawledListing {
  source_name?:        string
  source_url?:         string                 // the listing-page URL we crawled
  listing_url?:        string                 // the detail URL of THIS listing
  title?:              string
  raw_price?:          string
  raw_currency?:       string
  raw_area?:           string
  raw_bedrooms?:       string
  raw_bathrooms?:      string
  raw_parking?:        string
  raw_maintenance?:    string
  raw_operation?:      string
  raw_property_type?:  string
  location_text?:      string
  description?:        string
  amenities?:          string[]
  agent_or_company?:   string
  is_featured?:        boolean
  raw_text?:           string
  extracted_data?:     Record<string, unknown>
}

// ── Normalized listing — engine-friendly ─────────────────────────
export interface NormalizedListing {
  source_name?:        string
  source_url?:         string
  listing_url?:        string
  title?:              string
  operation_type?:     "sale" | "rent"
  property_type?:      string
  price?:              number
  currency?:           string
  maintenance_fee?:    number
  price_usd?:          number
  price_crc?:          number
  bedrooms?:           number
  bathrooms?:          number
  parking_spaces?:     number
  built_area_m2?:      number
  lot_area_m2?:        number
  price_per_m2?:       number
  location_text?:      string
  province?:           string
  canton?:             string
  district?:           string
  neighborhood?:       string
  latitude?:           number
  longitude?:          number
  amenities?:          string[]
  description?:        string
  agent_or_company?:   string
  is_featured?:        boolean
  raw_text?:           string
  extracted_data?:     Record<string, unknown>
  // Engine annotations
  similarity_score?:   number   // 0..100
  confidence_score?:   number   // 0..100
  is_outlier?:         boolean
  exclusion_reason?:   string
}

// ── Subject (the user's own property) ────────────────────────────
export interface SubjectProperty {
  id:                string
  title:             string
  slug:              string
  property_type:     string
  listing_type:      MarketReportType   // sale | rent
  bedrooms?:         number | null
  bathrooms?:        number | null
  parking_spaces?:   number | null
  area_sqm?:         number | null
  maintenance_fee?:  number | null
  price?:            number | null
  currency?:         string | null
  display_address?:  string | null
  display_lat?:      number | null
  display_lng?:      number | null
  province?:         string | null
  canton?:           string | null
  district?:         string | null
  amenities?:        string[]
  is_furnished?:     boolean
}

// ── Filter config (from form) ────────────────────────────────────
export interface MarketFilterConfig {
  matchOperationType:     boolean
  matchPropertyType:      boolean
  prioritizeSameCanton:   boolean
  prioritizeSameDistrict: boolean
  excludeWithoutPrice:    boolean
  excludeOutliers:        boolean
  excludeWithoutArea:     boolean
  // Optional advanced
  nearbyZones?:           string[]
  minArea?:               number
  maxArea?:               number
  minPrice?:              number
  maxPrice?:              number
  bedroomsTolerance?:     number
  bathroomsTolerance?:    number
}

// ── Pricing engine output ────────────────────────────────────────
export interface PricingMetrics {
  // Aggregate stats
  averagePrice:           number
  medianPrice:            number
  averagePricePerM2:      number
  medianPricePerM2:       number
  weightedPricePerM2:     number

  // Recommendations (deterministic — never AI)
  recommendedPrice:       number
  recommendedPriceMin:    number
  recommendedPriceMax:    number

  // Strategy scenarios
  aggressivePrice:        number
  balancedPrice:          number
  aspirationalPrice:      number

  // Confidence (0..100)
  confidenceScore:        number
  confidenceLabel:        "Low" | "Medium" | "High"

  // Counts
  validComparables:       number
  excludedListings:       number
  outliersDetected:       number

  // Inputs for the AI explanation (so the model can ground itself)
  currency:               string
  subjectAreaUsed:        number | null
}

// ── Source detection (URL classification) ────────────────────────
export interface SourceDetection {
  url:                string
  source_name:        string                            // 'encuentra24' | 'mercadolibre' | 'generic' | 'unsupported'
  source_type:        "listing_page" | "property_detail_page" | "unsupported"
  detected_category?: string                            // 'rental_apartments', 'sale_houses', etc.
  is_broad?:          boolean                           // listing page covering whole country / no filters
  warning?:           string
}

// ── Event log ────────────────────────────────────────────────────
export type MarketEventType =
  | "report_created"
  | "source_detected"
  | "crawling_started"
  | "page_scanned"
  | "listings_extracted"
  | "normalization_completed"
  | "exchange_rate_applied"
  | "comparables_filtered"
  | "outliers_detected"
  | "pricing_calculated"
  | "site_analysis_completed"
  | "openai_report_generated"
  | "pdf_generated"
  | "report_completed"
  | "report_failed"

// ── OpenAI report shape (also enforced by Zod in schemas.ts) ─────
export interface OpenAIMarketReport {
  executive_summary:        string
  recommended_price:        number
  recommended_price_min:    number
  recommended_price_max:    number
  currency:                 "USD" | "CRC"
  confidence_label:         "Low" | "Medium" | "High"
  confidence_explanation:   string
  market_position:          string
  pricing_rationale:        string
  owner_friendly_explanation: string
  competitive_summary:      string
  location_insights:        string
  amenities_insights:       string
  risks:                    string[]
  opportunities:            string[]
  suggested_listing_strategy: {
    initial_listing_price:  number
    negotiation_floor:      number
    review_after_days:      number
    strategy_explanation:   string
  }
  pricing_scenarios: {
    aggressive:   { price: number; description: string }
    balanced:     { price: number; description: string }
    aspirational: { price: number; description: string }
  }
  methodology:              string
  limitations:              string[]
  disclaimer:               string
  /** Public-maps site analysis for the subject property. Optional —
   *  may be null if Overpass was unreachable or the property has no
   *  coordinates. Always deterministically computed; the AI never
   *  fills this in (we force-overwrite post-validation). */
  site_analysis?:           SiteAnalysis | null
}
