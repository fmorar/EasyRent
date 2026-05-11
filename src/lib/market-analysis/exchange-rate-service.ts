// ============================================================
// Exchange Rate Service — USD/CRC
//
// Strategy:
//   1. Read FX_USD_CRC_OVERRIDE env if set (manual override).
//   2. Read fx_rate_cache for today.
//   3. Fall back to exchangerate.host (free, no key) and persist.
//   4. Final fallback: a hardcoded sane default (560).
//
// All callers should go through `getUsdToCrcRate(supabase)`.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

const HARD_FALLBACK_USD_TO_CRC = 560

export async function getUsdToCrcRate(
  supabase: SupabaseClient<Database>,
): Promise<{ rate: number; source: string; date: string }> {
  // 1. Env override
  const override = process.env.FX_USD_CRC_OVERRIDE
  if (override) {
    const n = parseFloat(override)
    if (Number.isFinite(n) && n > 0) {
      return { rate: n, source: "env_override", date: today() }
    }
  }

  // 2. DB cache for today
  const date = today()
  const { data: cached } = await supabase
    .from("fx_rate_cache")
    .select("usd_to_crc, source")
    .eq("date", date)
    .maybeSingle()

  if (cached) {
    return { rate: Number(cached.usd_to_crc), source: cached.source, date }
  }

  // 3. Fetch fresh
  const fresh = await fetchExchangerateHost()
  if (fresh) {
    await supabase.from("fx_rate_cache").upsert({
      date,
      usd_to_crc: fresh,
      source:     "exchangerate.host",
      fetched_at: new Date().toISOString(),
    }, { onConflict: "date" })
    return { rate: fresh, source: "exchangerate.host", date }
  }

  // 4. Hard fallback (don't persist)
  return { rate: HARD_FALLBACK_USD_TO_CRC, source: "hard_fallback", date }
}

// ── Conversion helpers ───────────────────────────────────────────
export function convertToUsd(amount: number, fromCurrency: string, usdToCrc: number): number {
  if (fromCurrency === "USD") return amount
  if (fromCurrency === "CRC") return amount / usdToCrc
  return amount
}

export function convertToCrc(amount: number, fromCurrency: string, usdToCrc: number): number {
  if (fromCurrency === "CRC") return amount
  if (fromCurrency === "USD") return amount * usdToCrc
  return amount
}

// ── Internals ────────────────────────────────────────────────────
async function fetchExchangerateHost(): Promise<number | null> {
  try {
    const res = await fetch("https://api.exchangerate.host/convert?from=USD&to=CRC", {
      headers: { "User-Agent": "re-platform-market-analysis/1.0" },
      // Time out aggressively — we have a fallback.
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { result?: number; info?: { rate?: number } }
    const rate = json.result ?? json.info?.rate
    if (typeof rate === "number" && rate > 0) return rate
    return null
  } catch {
    return null
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
