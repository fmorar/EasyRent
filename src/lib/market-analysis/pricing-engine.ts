// ============================================================
// Pricing Engine — DETERMINISTIC
//
// Inputs: subject property + normalized comparables (already
//         currency-converted to a single target).
// Output: PricingMetrics — recommended price + range + scenarios.
//
// AI never modifies these numbers; it only narrates them.
// ============================================================

import type {
  NormalizedListing, PricingMetrics, SubjectProperty, MarketFilterConfig,
} from "./types"

interface PriceEngineInput {
  subject:     SubjectProperty
  comparables: NormalizedListing[]   // already kept by filter, currency-normalized
  currency:    "USD" | "CRC"
  filters:     MarketFilterConfig
}

export function computePricing(input: PriceEngineInput): {
  metrics:        PricingMetrics
  validUsed:      NormalizedListing[]
  outliersFound:  NormalizedListing[]
} {
  const { subject, comparables, currency, filters } = input

  // 1 — keep only those with price + area when we can
  let valid = comparables.filter((c) => c.price != null && c.price > 0)

  // 2 — outlier detection on price_per_m2 using IQR
  const ppm2: number[] = valid.map(priceOrPpm2).filter((n): n is number => n != null && Number.isFinite(n))
  const outlierBounds = ppm2.length >= 5 ? iqrBounds(ppm2) : null
  const outliers: NormalizedListing[] = []

  if (filters.excludeOutliers && outlierBounds) {
    const next: NormalizedListing[] = []
    for (const c of valid) {
      const x = priceOrPpm2(c)
      if (x != null && (x < outlierBounds.lower || x > outlierBounds.upper)) {
        c.is_outlier = true
        c.exclusion_reason = "outlier_iqr"
        outliers.push(c)
      } else {
        next.push(c)
      }
    }
    valid = next
  } else if (outlierBounds) {
    // Tag without removing
    for (const c of valid) {
      const x = priceOrPpm2(c)
      if (x != null && (x < outlierBounds.lower || x > outlierBounds.upper)) {
        c.is_outlier = true
      }
    }
  }

  // 3 — central tendency stats
  const prices = valid.map((c) => c.price!).filter(Number.isFinite)
  const ppm2Valid = valid.map(priceOrPpm2).filter((n): n is number => n != null && Number.isFinite(n))

  const averagePrice      = mean(prices)
  const medianPrice       = median(prices)
  const averagePricePerM2 = mean(ppm2Valid)
  const medianPricePerM2  = median(ppm2Valid)

  // 4 — weighted price/m² (weight = similarity_score, default 50)
  const weightedPricePerM2 = weightedMean(
    valid.map(priceOrPpm2).filter((n): n is number => n != null),
    valid.filter((c) => priceOrPpm2(c) != null).map((c) => Math.max(1, c.similarity_score ?? 50)),
  )

  // 5 — recommended price
  const subjectArea = subject.area_sqm ?? null
  let recommendedPrice = 0
  if (subjectArea && subjectArea > 0 && weightedPricePerM2 > 0) {
    recommendedPrice = weightedPricePerM2 * subjectArea
  } else if (medianPrice > 0) {
    recommendedPrice = medianPrice
  }

  // 6 — range = ±10% (tightened by confidence)
  const baseSpread = 0.10
  const recommendedPriceMin = round(recommendedPrice * (1 - baseSpread))
  const recommendedPriceMax = round(recommendedPrice * (1 + baseSpread))

  // 7 — scenarios
  const aggressivePrice   = round(recommendedPrice * 0.93)   // sell faster
  const balancedPrice     = round(recommendedPrice)
  const aspirationalPrice = round(recommendedPrice * 1.07)   // test the upper end

  // 8 — confidence
  const confidence = scoreConfidence({
    validCount:    valid.length,
    excludedCount: input.comparables.length - valid.length,
    hasArea:       subjectArea != null && subjectArea > 0,
    outlierShare:  outliers.length / Math.max(1, input.comparables.length),
    similarityAvg: mean(valid.map((c) => c.similarity_score ?? 0)),
  })

  return {
    metrics: {
      averagePrice:           round(averagePrice),
      medianPrice:            round(medianPrice),
      averagePricePerM2:      round(averagePricePerM2),
      medianPricePerM2:       round(medianPricePerM2),
      weightedPricePerM2:     round(weightedPricePerM2),

      recommendedPrice:       round(recommendedPrice),
      recommendedPriceMin,
      recommendedPriceMax,

      aggressivePrice,
      balancedPrice,
      aspirationalPrice,

      confidenceScore:        confidence.score,
      confidenceLabel:        confidence.label,

      validComparables:       valid.length,
      excludedListings:       input.comparables.length - valid.length,
      outliersDetected:       outliers.length,

      currency,
      subjectAreaUsed:        subjectArea,
    },
    validUsed:     valid,
    outliersFound: outliers,
  }
}

// ── Stats helpers ────────────────────────────────────────────────
function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}
function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
function weightedMean(xs: number[], ws: number[]): number {
  let n = 0, d = 0
  for (let i = 0; i < xs.length; i++) {
    const w = ws[i] ?? 1
    n += xs[i] * w
    d += w
  }
  return d === 0 ? 0 : n / d
}
function quantile(sortedAsc: number[], q: number): number {
  const i = (sortedAsc.length - 1) * q
  const lo = Math.floor(i), hi = Math.ceil(i)
  if (lo === hi) return sortedAsc[lo]
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (i - lo)
}
function iqrBounds(xs: number[]): { lower: number; upper: number } {
  const s = [...xs].sort((a, b) => a - b)
  const q1 = quantile(s, 0.25), q3 = quantile(s, 0.75)
  const iqr = q3 - q1
  return { lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr }
}
function round(n: number): number { return Math.round(n) }

// ── Confidence ──────────────────────────────────────────────────
function scoreConfidence(args: {
  validCount: number
  excludedCount: number
  hasArea: boolean
  outlierShare: number
  similarityAvg: number
}): { score: number; label: "Low" | "Medium" | "High" } {
  const countScore = Math.min(1, args.validCount / 12)
  const areaScore  = args.hasArea ? 1 : 0.5
  const outlierPenalty = Math.max(0, 1 - args.outlierShare * 2)
  const simScore   = Math.max(0, Math.min(1, args.similarityAvg / 100))

  const raw = (countScore * 0.45 + simScore * 0.30 + areaScore * 0.15 + outlierPenalty * 0.10) * 100
  const score = Math.round(Math.max(0, Math.min(100, raw)))

  let label: "Low" | "Medium" | "High" = "Low"
  if (score >= 75)      label = "High"
  else if (score >= 50) label = "Medium"

  return { score, label }
}

function priceOrPpm2(c: NormalizedListing): number | undefined {
  return c.price_per_m2 ?? undefined
}
