// ============================================================
// Similarity score (0..100)
//
// Weighted blend:
//   • Location match   35%
//   • Property type    20%
//   • Built area       15%
//   • Beds/baths       10%
//   • Amenities        10%
//   • Parking/maint     5%
//   • Completeness      5%
// ============================================================

import type { NormalizedListing, SubjectProperty } from "./types"

export function scoreSimilarity(
  subject: SubjectProperty,
  c: NormalizedListing,
): { score: number; confidence: number } {
  const w = {
    location:    35,
    propertyType: 20,
    area:        15,
    bedsBaths:   10,
    amenities:   10,
    parkingMaint: 5,
    completeness: 5,
  }

  let s = 0

  // ── Location ───────────────────────────────────────────────
  s += w.location * locationScore(subject, c)
  // ── Property type ──────────────────────────────────────────
  s += w.propertyType * (
    subject.property_type && c.property_type
      ? (subject.property_type.toLowerCase() === c.property_type.toLowerCase() ? 1 : 0)
      : 0.5    // unknown — half credit
  )
  // ── Area ───────────────────────────────────────────────────
  s += w.area * areaScore(subject.area_sqm, c.built_area_m2)
  // ── Beds/baths ─────────────────────────────────────────────
  s += w.bedsBaths * roomScore(subject, c)
  // ── Amenities ──────────────────────────────────────────────
  s += w.amenities * amenityScore(subject.amenities, c.amenities)
  // ── Parking + maintenance ──────────────────────────────────
  s += w.parkingMaint * parkingMaintScore(subject, c)
  // ── Completeness ───────────────────────────────────────────
  s += w.completeness * completenessScore(c)

  return {
    score:      Math.round(s),
    confidence: completenessScore(c) * 100,    // 0..100
  }
}

function locationScore(subj: SubjectProperty, c: NormalizedListing): number {
  if (!subj.canton && !subj.district && !subj.province) return 0.5
  let s = 0
  if (subj.district && c.district && subj.district.toLowerCase() === c.district.toLowerCase()) s = Math.max(s, 1.0)
  if (subj.canton   && c.canton   && subj.canton.toLowerCase()   === c.canton.toLowerCase())   s = Math.max(s, 0.85)
  if (subj.province && c.province && subj.province.toLowerCase() === c.province.toLowerCase()) s = Math.max(s, 0.6)
  return s
}

function areaScore(subjArea?: number | null, compArea?: number): number {
  if (subjArea == null || compArea == null || subjArea <= 0) return 0.5
  const ratio = compArea / subjArea
  // Best at 0.85..1.15, decay outwards
  if (ratio >= 0.85 && ratio <= 1.15) return 1
  if (ratio >= 0.7 && ratio <= 1.3)   return 0.7
  if (ratio >= 0.5 && ratio <= 1.6)   return 0.4
  return 0.1
}

function roomScore(subj: SubjectProperty, c: NormalizedListing): number {
  let s = 0
  let count = 0

  if (subj.bedrooms != null && c.bedrooms != null) {
    s += Math.max(0, 1 - Math.abs(c.bedrooms - subj.bedrooms) * 0.4)
    count++
  }
  if (subj.bathrooms != null && c.bathrooms != null) {
    s += Math.max(0, 1 - Math.abs(c.bathrooms - subj.bathrooms) * 0.4)
    count++
  }
  return count === 0 ? 0.5 : s / count
}

function amenityScore(subj?: string[], comp?: string[]): number {
  if (!subj?.length || !comp?.length) return 0.5
  const a = new Set(subj.map((x) => x.toLowerCase()))
  const b = new Set(comp.map((x) => x.toLowerCase()))
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  const union = a.size + b.size - inter
  return union === 0 ? 0.5 : inter / union
}

function parkingMaintScore(subj: SubjectProperty, c: NormalizedListing): number {
  let s = 0
  let n = 0
  if (subj.parking_spaces != null && c.parking_spaces != null) {
    s += Math.max(0, 1 - Math.abs(c.parking_spaces - subj.parking_spaces) * 0.5)
    n++
  }
  if (subj.maintenance_fee != null && c.maintenance_fee != null) {
    const ratio = c.maintenance_fee / Math.max(1, subj.maintenance_fee)
    if (ratio >= 0.7 && ratio <= 1.3) s += 1
    else if (ratio >= 0.5 && ratio <= 1.6) s += 0.5
    n++
  }
  return n === 0 ? 0.5 : s / n
}

function completenessScore(c: NormalizedListing): number {
  const fields = [
    c.price, c.currency, c.built_area_m2, c.bedrooms, c.bathrooms,
    c.location_text, c.property_type, c.operation_type,
  ]
  const present = fields.filter((v) => v != null && v !== "").length
  return present / fields.length
}
