/**
 * Single source of truth for all enum/status labels shown in the UI.
 *
 * Avoid duplicating these maps across pages — import from here.
 * Strings are in Spanish (the app's primary locale); English equivalents
 * come via next-intl translations on public pages.
 */

import type {
  PropertyStatus,
  PropertyType,
  ListingType,
  ProjectStatus,
  InvitationStatus,
  ShareStatus,
  LeadStage,
  LeadSource,
  CommissionType,
} from "@/types"

// ── Property ─────────────────────────────────────────────────────
export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  available:  "Disponible",
  reserved:   "Reservado",
  sold:       "Vendido",
  off_market: "Fuera de mercado",
}

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment:  "Apartamento",
  house:      "Casa",
  land:       "Terreno",
  commercial: "Comercial",
  office:     "Oficina",
  warehouse:  "Bodega",
}

// `sale` vs `rent` — orthogonal to PROPERTY_STATUS_LABELS (which tracks
// availability). `available + sale` = "En venta", `available + rent` =
// "En alquiler". Combine via `formatListingState()` below.
export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  sale: "En venta",
  rent: "En alquiler",
}

/**
 * Headline state combining listing intent + availability status:
 *   sale + available    → "En venta"
 *   rent + available    → "En alquiler"
 *   sale + sold         → "Vendido"
 *   rent + sold         → "Alquilado"        (rent + 'sold' is interpreted as rented)
 *   *    + reserved     → "Reservado"
 *   *    + off_market   → "Fuera de mercado"
 */
export function formatListingState(
  listingType: ListingType,
  status:      PropertyStatus,
): string {
  if (status === "reserved")   return "Reservado"
  if (status === "off_market") return "Fuera de mercado"
  if (status === "sold")       return listingType === "rent" ? "Alquilado" : "Vendido"
  // available
  return LISTING_TYPE_LABELS[listingType]
}

// ── Project ──────────────────────────────────────────────────────
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  pre_launch:         "Pre-lanzamiento",
  under_construction: "En construcción",
  completed:          "Completado",
  on_hold:            "En pausa",
}

// ── Invitations ──────────────────────────────────────────────────
export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  pending:  "Pendiente",
  accepted: "Aceptada",
  expired:  "Expirada",
  revoked:  "Revocada",
}

// ── Property shares ──────────────────────────────────────────────
export const SHARE_STATUS_LABELS: Record<ShareStatus, string> = {
  pending:  "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  revoked:  "Revocada",
}

export const COMMISSION_TYPE_LABELS: Record<CommissionType, string> = {
  percentage: "Porcentaje",
  fixed:      "Monto fijo",
}

// ── Leads ────────────────────────────────────────────────────────
export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new:                "Nuevo",
  contacted:          "Contactado",
  interested:         "Interesado",
  visit_scheduled:    "Visita agendada",
  negotiating:        "En negociación",
  contract_requested: "Contrato solicitado",
  closed:             "Cerrado",
  lost:               "Perdido",
}

/**
 * Where the lead came in from. Used in the inbox UI, the kanban filters,
 * and the new-lead email notification subject/header.
 */
export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  marketplace:    "Marketplace easyrent",
  agent_profile:  "Perfil de agente",
  project_page:   "Página de proyecto",
  anonymous_link: "Link sin marca",
  whatsapp:       "WhatsApp",
  direct:         "Contacto directo",
  referral:       "Referido",
}

// ── Helpers ──────────────────────────────────────────────────────
export function formatCommission(
  type:  CommissionType | null,
  value: number | null,
): string {
  if (type == null || value == null) return "—"
  return type === "percentage" ? `${value}%` : `$${value.toLocaleString()}`
}
