// ============================================================
// GET /api/countries
//
// Returns the list of countries with their ISO 2-letter code,
// localized name, dial code (e.g. "+506") and flag emoji. Used
// by the public contact forms so visitors can pick the country
// code for their WhatsApp / phone number.
//
// Data source: https://restcountries.com (free, no API key).
// We fetch with Next's ISR cache + a 24h revalidate so we hit
// the upstream API at most once per day per Vercel region.
// On failure we fall back to a small static list covering the
// CR market + nearby diaspora — the form keeps working without
// network access.
// ============================================================

import { NextResponse } from "next/server"

export const runtime  = "nodejs"
export const revalidate = 86400  // 24h

export interface Country {
  /** ISO 3166-1 alpha-2 — used as the React `key` and as a
   *  stable identifier across locales. */
  code:     string
  /** Localized country name (Spanish when available). */
  name:     string
  /** Dial code with leading "+" (e.g. "+506"). */
  dial:     string
  /** Unicode flag emoji. */
  flag:     string
}

// ── Public route handler ───────────────────────────────────────
export async function GET() {
  try {
    // Fields filter keeps the payload small (~50KB instead of 2MB).
    const res = await fetch(
      "https://restcountries.com/v3.1/all?fields=cca2,name,idd,flag,translations",
      {
        // Cache the response — Next will refresh once a day.
        next:    { revalidate: 86400 },
        signal:  AbortSignal.timeout(8000),
        headers: { "Accept": "application/json" },
      },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const raw = await res.json() as RawCountry[]
    const list = normalize(raw)
    return NextResponse.json({ countries: list }, {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    })
  } catch {
    // Fallback to the static list. Don't 500 — the consumer needs a
    // usable dropdown even if restcountries.com is down.
    return NextResponse.json({ countries: FALLBACK, stale: true }, { status: 200 })
  }
}

// ── Helpers ────────────────────────────────────────────────────
interface RawCountry {
  cca2?:         string
  name?:         { common?: string }
  idd?:          { root?: string; suffixes?: string[] }
  flag?:         string
  translations?: { spa?: { common?: string } }
}

function normalize(raw: RawCountry[]): Country[] {
  const out: Country[] = []
  for (const c of raw) {
    if (!c.cca2 || !c.idd?.root) continue
    // Multi-suffix entries (US areas, UK overseas territories) collapse
    // to the FIRST suffix — that's the canonical country dial code; the
    // others are sub-regions the visitor rarely wants in this UI.
    const suffix = c.idd.suffixes?.[0] ?? ""
    const dial   = `${c.idd.root}${suffix}`
    // Some entries (e.g. Antarctica) have no real dial code. Skip.
    if (!/^\+\d{1,4}$/.test(dial)) continue
    out.push({
      code: c.cca2,
      name: c.translations?.spa?.common ?? c.name?.common ?? c.cca2,
      dial,
      flag: c.flag ?? "",
    })
  }
  // CR first, then alphabetical by localized name.
  out.sort((a, b) => {
    if (a.code === "CR") return -1
    if (b.code === "CR") return  1
    return a.name.localeCompare(b.name, "es")
  })
  return out
}

// ── Fallback list (used when restcountries.com is down) ───────
// Curated for the CR market + the main diaspora origin countries.
const FALLBACK: Country[] = [
  { code: "CR", name: "Costa Rica",         dial: "+506", flag: "🇨🇷" },
  { code: "US", name: "Estados Unidos",     dial: "+1",   flag: "🇺🇸" },
  { code: "CA", name: "Canadá",             dial: "+1",   flag: "🇨🇦" },
  { code: "MX", name: "México",             dial: "+52",  flag: "🇲🇽" },
  { code: "GT", name: "Guatemala",          dial: "+502", flag: "🇬🇹" },
  { code: "HN", name: "Honduras",           dial: "+504", flag: "🇭🇳" },
  { code: "SV", name: "El Salvador",        dial: "+503", flag: "🇸🇻" },
  { code: "NI", name: "Nicaragua",          dial: "+505", flag: "🇳🇮" },
  { code: "PA", name: "Panamá",             dial: "+507", flag: "🇵🇦" },
  { code: "CO", name: "Colombia",           dial: "+57",  flag: "🇨🇴" },
  { code: "VE", name: "Venezuela",          dial: "+58",  flag: "🇻🇪" },
  { code: "EC", name: "Ecuador",            dial: "+593", flag: "🇪🇨" },
  { code: "PE", name: "Perú",               dial: "+51",  flag: "🇵🇪" },
  { code: "BR", name: "Brasil",             dial: "+55",  flag: "🇧🇷" },
  { code: "AR", name: "Argentina",          dial: "+54",  flag: "🇦🇷" },
  { code: "CL", name: "Chile",              dial: "+56",  flag: "🇨🇱" },
  { code: "UY", name: "Uruguay",            dial: "+598", flag: "🇺🇾" },
  { code: "PY", name: "Paraguay",           dial: "+595", flag: "🇵🇾" },
  { code: "BO", name: "Bolivia",            dial: "+591", flag: "🇧🇴" },
  { code: "DO", name: "República Dominicana", dial: "+1", flag: "🇩🇴" },
  { code: "CU", name: "Cuba",               dial: "+53",  flag: "🇨🇺" },
  { code: "PR", name: "Puerto Rico",        dial: "+1",   flag: "🇵🇷" },
  { code: "ES", name: "España",             dial: "+34",  flag: "🇪🇸" },
  { code: "FR", name: "Francia",            dial: "+33",  flag: "🇫🇷" },
  { code: "IT", name: "Italia",             dial: "+39",  flag: "🇮🇹" },
  { code: "DE", name: "Alemania",           dial: "+49",  flag: "🇩🇪" },
  { code: "GB", name: "Reino Unido",        dial: "+44",  flag: "🇬🇧" },
  { code: "NL", name: "Países Bajos",       dial: "+31",  flag: "🇳🇱" },
  { code: "CH", name: "Suiza",              dial: "+41",  flag: "🇨🇭" },
  { code: "AU", name: "Australia",          dial: "+61",  flag: "🇦🇺" },
  { code: "NZ", name: "Nueva Zelanda",      dial: "+64",  flag: "🇳🇿" },
]
