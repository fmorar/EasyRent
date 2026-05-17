import "server-only"

/**
 * USD ↔ CRC FX conversion for the WhatsApp concierge.
 *
 * Why this exists: Costa Rican listings are priced in either USD or
 * CRC depending on the owner's preference. A lead who says "budget
 * $1.300" needs to see CRC listings up to about ₡680.000 (at current
 * rates), and a lead who says "₡500.000" needs to see USD listings
 * under ~$960. Filtering by raw currency-as-passed misses half the
 * catalog.
 *
 * Source: `open.er-api.com` — free, no API key required, gives
 * mid-market rates that are within ~1% of BCCR's official rate (more
 * than precise enough for "does this listing fit the lead's budget").
 *
 * Caching: in-process for 6 hours. FX doesn't move enough intraday
 * to matter for budget matching, and we don't want to pay the rate
 * provider on every webhook turn. Vercel serverless cold-starts
 * eat the cache, but that's still <100 API calls/day at our volume.
 *
 * Fallback: if the API is down or returns garbage, we use the last
 * known-good rate (FALLBACK_USD_TO_CRC). This protects the search
 * pipeline from failing entirely during an FX outage — the worst
 * case is the budget filter drifts by a few percent for a few hours.
 */

const CACHE_TTL_MS         = 6 * 60 * 60 * 1000
/** Sanity range: anything outside this is almost certainly wrong data
 *  (e.g. API returned the rate inverted, or the JSON shape changed). */
const RATE_MIN             = 400
const RATE_MAX             = 800
/** Hardcoded last-known-good rate, used when the API fails. Bump this
 *  number any time the live CRC/USD rate drifts > 5% from it (i.e.,
 *  once or twice a year in normal markets). */
const FALLBACK_USD_TO_CRC  = 520

interface CachedRate { value: number; fetchedAt: number }
let cached: CachedRate | null = null

export interface FxResult {
  /** Colones per US dollar. Multiply USD * rate to get CRC. */
  usdToCrc:   number
  /** True when we fell back to the hardcoded constant — the agent can
   *  use this to caveat the conversion in the reply ("aproximadamente"). */
  isFallback: boolean
}

export async function getUsdToCrcRate(): Promise<FxResult> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { usdToCrc: cached.value, isFallback: false }
  }
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(3_000),
    })
    if (!res.ok) throw new Error(`status ${res.status}`)
    const data = (await res.json()) as { rates?: Record<string, number> }
    const crc  = data.rates?.CRC
    if (typeof crc !== "number" || crc < RATE_MIN || crc > RATE_MAX) {
      throw new Error(`out-of-range rate: ${crc}`)
    }
    cached = { value: crc, fetchedAt: Date.now() }
    return { usdToCrc: crc, isFallback: false }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[fx] live rate fetch failed (${msg}); using fallback ${FALLBACK_USD_TO_CRC}`)
    return { usdToCrc: FALLBACK_USD_TO_CRC, isFallback: true }
  }
}

/**
 * Convert an amount between USD and CRC. Returns the input unchanged
 * when source / target currency match, or when either currency is
 * neither USD nor CRC (defensive — we don't support other currencies).
 */
export function convertPrice(
  amount:       number,
  fromCurrency: string | null | undefined,
  toCurrency:   string,
  usdToCrcRate: number,
): number {
  const from = (fromCurrency ?? "").toUpperCase()
  const to   = toCurrency.toUpperCase()
  if (from === to)                    return amount
  if (from === "USD" && to === "CRC") return amount * usdToCrcRate
  if (from === "CRC" && to === "USD") return amount / usdToCrcRate
  return amount
}

/** Round helpers — keep the prompt output readable without lying about precision. */
export function roundUsd(n: number): number { return Math.round(n) }
export function roundCrc(n: number): number { return Math.round(n / 1000) * 1000 }
