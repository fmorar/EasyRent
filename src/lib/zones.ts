// Costa Rica zone taxonomy — 3-level hierarchy.
//
//   Category   →  Zone        →  Subzone (district / town)
//   ---------     ----------     ---------------------------
//   GAM        →  GAM Oeste   →  Escazú · Santa Ana · Lindora · …
//
// Profiles store any combination of codes from this taxonomy in
// `profile.zones TEXT[]`. Codes can mix levels:
//
//   • A zone code (e.g. 'gam_oeste') means "covers all of GAM Oeste".
//   • A subzone code (e.g. 'gam_oeste__escazu') means "covers just
//     Escazú" — useful when an agent operates mostly in Oeste but
//     also handles a single district in another zone.
//
// Querying: `expandToSubzones(codes)` resolves a mixed list to the
// flat set of subzone codes it implies, which is what the share
// dialog uses to compute zone membership.

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type CategoryCode =
  | "gam"
  | "cartago"
  | "guanacaste"
  | "pacifico_central"
  | "pacifico_sur"
  | "caribe"
  | "zona_norte"
  | "puntarenas"

export type ZoneCode =
  | "gam_oeste"
  | "gam_este"
  | "gam_norte"
  | "gam_alajuela"
  | "cartago"
  | "guanacaste_norte"
  | "guanacaste_costa_dorada"
  | "guanacaste_azul"
  | "pacifico_central_jaco"
  | "pacifico_central_quepos"
  | "pacifico_sur_dominical"
  | "pacifico_sur_zona_sur"
  | "caribe_norte"
  | "caribe_sur"
  | "zona_norte_san_carlos"
  | "zona_norte_rural"
  | "puntarenas_centro"

/** Subzone codes are `<zoneCode>__<slug>`. */
export type SubzoneCode = string

export interface Subzone {
  code:     SubzoneCode  // e.g. "gam_oeste__escazu"
  zone:     ZoneCode
  category: CategoryCode
  label:    string       // e.g. "Escazú"
}

export interface Zone {
  code:       ZoneCode
  category:   CategoryCode
  /** Long label (e.g. "GAM Oeste"). */
  label:      string
  /** Short label without category prefix (e.g. "Oeste"). */
  shortLabel: string
  subzones:   Subzone[]
}

export interface Category {
  code:   CategoryCode
  label:  string
  zones:  Zone[]
}

// ─────────────────────────────────────────────
// Taxonomy
// ─────────────────────────────────────────────

function makeZone(
  category: CategoryCode,
  code:     ZoneCode,
  label:    string,
  shortLabel: string,
  subzoneNames: string[],
): Zone {
  const subzones: Subzone[] = subzoneNames.map((name) => ({
    code:     `${code}__${slugify(name)}`,
    zone:     code,
    category,
    label:    name,
  }))
  return { code, category, label, shortLabel, subzones }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")  // strip accents
    .replace(/&/g, "y")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
}

export const CATEGORIES: Category[] = [
  // ─── GAM ────────────────────────────────────────────────
  {
    code:  "gam",
    label: "Gran Área Metropolitana",
    zones: [
      makeZone("gam", "gam_oeste",    "GAM Oeste",    "Oeste",
        ["Escazú", "Santa Ana", "Lindora", "Rohrmoser", "Sabana", "Pavas"]),
      makeZone("gam", "gam_este",     "GAM Este",     "Este",
        ["Curridabat", "Granadilla", "Tres Ríos", "Sabanilla", "Moravia", "Montes de Oca"]),
      makeZone("gam", "gam_norte",    "GAM Norte",    "Norte",
        ["Heredia Centro", "Belén", "San Pablo", "Barva", "Santo Domingo", "Lagunilla"]),
      makeZone("gam", "gam_alajuela", "GAM Alajuela", "Alajuela",
        ["Alajuela Centro", "La Guácima", "Coyol", "Grecia", "Atenas", "Naranjo"]),
    ],
  },
  // ─── Cartago ────────────────────────────────────────────
  {
    code:  "cartago",
    label: "Cartago",
    zones: [
      makeZone("cartago", "cartago", "Cartago", "Cartago",
        ["Cartago Centro", "Paraíso", "Oreamuno", "El Guarco", "Tres Ríos Este"]),
    ],
  },
  // ─── Guanacaste ─────────────────────────────────────────
  {
    code:  "guanacaste",
    label: "Guanacaste",
    zones: [
      makeZone("guanacaste", "guanacaste_norte",         "Guanacaste Norte",         "Norte",
        ["Liberia", "Papagayo", "Playas del Coco", "Hermosa", "Ocotal"]),
      makeZone("guanacaste", "guanacaste_costa_dorada",  "Guanacaste Costa Dorada",  "Costa Dorada",
        ["Tamarindo", "Flamingo", "Potrero", "Brasilito", "Conchal"]),
      makeZone("guanacaste", "guanacaste_azul",          "Guanacaste Azul",          "Azul",
        ["Nosara", "Sámara", "Carrillo", "Garza"]),
    ],
  },
  // ─── Pacífico Central ───────────────────────────────────
  {
    code:  "pacifico_central",
    label: "Pacífico Central",
    zones: [
      makeZone("pacifico_central", "pacifico_central_jaco",   "Jacó & Central Pacific", "Jacó",
        ["Jacó", "Herradura", "Playa Hermosa", "Esterillos", "Bejuco"]),
      makeZone("pacifico_central", "pacifico_central_quepos", "Quepos & Manuel Antonio", "Quepos",
        ["Quepos", "Manuel Antonio", "Parrita"]),
    ],
  },
  // ─── Pacífico Sur ───────────────────────────────────────
  {
    code:  "pacifico_sur",
    label: "Pacífico Sur",
    zones: [
      makeZone("pacifico_sur", "pacifico_sur_dominical", "Dominical & Uvita", "Dominical",
        ["Dominical", "Uvita", "Ojochal", "Bahía Ballena"]),
      makeZone("pacifico_sur", "pacifico_sur_zona_sur",  "Zona Sur",          "Zona Sur",
        ["Golfito", "Puerto Jiménez", "Ciudad Neily", "Pavones"]),
    ],
  },
  // ─── Caribe ─────────────────────────────────────────────
  {
    code:  "caribe",
    label: "Caribe",
    zones: [
      makeZone("caribe", "caribe_norte", "Caribe Norte", "Norte",
        ["Limón Centro", "Guápiles", "Siquirres"]),
      makeZone("caribe", "caribe_sur",   "Caribe Sur",   "Sur",
        ["Puerto Viejo", "Cahuita", "Cocles", "Manzanillo"]),
    ],
  },
  // ─── Zona Norte ─────────────────────────────────────────
  {
    code:  "zona_norte",
    label: "Zona Norte",
    zones: [
      makeZone("zona_norte", "zona_norte_san_carlos", "San Carlos",        "San Carlos",
        ["La Fortuna", "Ciudad Quesada", "Arenal"]),
      makeZone("zona_norte", "zona_norte_rural",     "Zona Norte Rural",  "Rural",
        ["Upala", "Guatuso", "Los Chiles"]),
    ],
  },
  // ─── Puntarenas ─────────────────────────────────────────
  {
    code:  "puntarenas",
    label: "Puntarenas",
    zones: [
      makeZone("puntarenas", "puntarenas_centro", "Puntarenas Centro", "Centro",
        ["Puntarenas", "Chacarita", "El Roble", "Barranca"]),
    ],
  },
]

// ─────────────────────────────────────────────
// Lookup tables
// ─────────────────────────────────────────────

export const ALL_ZONES: Zone[] = CATEGORIES.flatMap((c) => c.zones)

export const ALL_SUBZONES: Subzone[] = ALL_ZONES.flatMap((z) => z.subzones)

export const ZONE_BY_CODE: Record<ZoneCode, Zone> = Object.fromEntries(
  ALL_ZONES.map((z) => [z.code, z]),
) as Record<ZoneCode, Zone>

export const SUBZONE_BY_CODE: Record<SubzoneCode, Subzone> = Object.fromEntries(
  ALL_SUBZONES.map((s) => [s.code, s]),
)

export const CATEGORY_BY_CODE: Record<CategoryCode, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.code, c]),
) as Record<CategoryCode, Category>

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

export function isZoneCode(code: string): code is ZoneCode {
  return code in ZONE_BY_CODE
}

export function isSubzoneCode(code: string): boolean {
  return code in SUBZONE_BY_CODE
}

/**
 * Resolve a mixed list of zone + subzone codes into the flat set of
 * subzone codes it covers. A zone code expands to all its subzones.
 *
 *   expandToSubzones(['gam_oeste', 'gam_este__curridabat'])
 *   → ['gam_oeste__escazu', 'gam_oeste__santa_ana', …, 'gam_este__curridabat']
 */
export function expandToSubzones(codes: string[]): SubzoneCode[] {
  const out = new Set<SubzoneCode>()
  for (const code of codes) {
    if (isZoneCode(code)) {
      for (const s of ZONE_BY_CODE[code].subzones) out.add(s.code)
    } else if (isSubzoneCode(code)) {
      out.add(code)
    }
    // unknown codes (deprecated zones) are silently skipped
  }
  return Array.from(out)
}

/**
 * Group a list of mixed codes by their parent zone, with metadata about
 * whether the agent covers the whole zone (`whole = true`) or just some
 * subzones (`whole = false`, plus the list of subzones they cover).
 *
 * Used to render an agent's coverage on their profile / chips.
 */
export function groupCodesByZone(codes: string[]): Array<{
  zone:      Zone
  whole:     boolean
  subzones:  Subzone[]   // only populated when whole === false
}> {
  const byZone = new Map<ZoneCode, { whole: boolean; subzones: Subzone[] }>()

  for (const code of codes) {
    if (isZoneCode(code)) {
      byZone.set(code, { whole: true, subzones: [] })
    } else if (isSubzoneCode(code)) {
      const sz   = SUBZONE_BY_CODE[code]
      const prev = byZone.get(sz.zone)
      if (prev?.whole) continue   // already wholly covered
      byZone.set(sz.zone, {
        whole:    false,
        subzones: [...(prev?.subzones ?? []), sz],
      })
    }
  }

  return ALL_ZONES
    .filter((z) => byZone.has(z.code))
    .map((z) => ({ zone: z, ...byZone.get(z.code)! }))
}

/**
 * Format a list of zone/subzone codes as a short Spanish label string
 * for chips, table cells, and bio lines.
 *
 *   ['gam_oeste']                     → "GAM Oeste"
 *   ['gam_oeste__escazu', 'gam_oeste__santa_ana']
 *                                     → "Escazú · Santa Ana"
 *   ['gam_oeste', 'gam_este__curridabat']
 *                                     → "GAM Oeste · Curridabat"
 */
export function formatZoneList(codes: string[] | null | undefined): string {
  if (!codes || codes.length === 0) return ""

  const grouped = groupCodesByZone(codes)
  return grouped
    .flatMap((g) => g.whole ? [g.zone.label] : g.subzones.map((s) => s.label))
    .join(" · ")
}

// ─────────────────────────────────────────────
// Back-compat re-exports
// ─────────────────────────────────────────────

export const ZONE_CATEGORY_ORDER: CategoryCode[] = CATEGORIES.map((c) => c.code)

export const ZONE_CATEGORY_LABELS: Record<CategoryCode, string> =
  Object.fromEntries(CATEGORIES.map((c) => [c.code, c.label])) as Record<CategoryCode, string>
