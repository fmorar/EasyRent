// Centralized role helpers so the UI stops doing
// `role === "owner_admin" ? "Admin" : "Agente"` ternaries — a pattern
// that silently mislabeled super_admin users as "Agente".
//
// is_admin() on the DB already treats super_admin + owner_admin as
// admin-tier; this matches that semantic on the client.

import type { UserRole } from "@/types"

/** True when the user has admin-level operational privileges
 *  (owner_admin or super_admin). Use this for sidebar gates,
 *  dashboard view-switches, route protections, etc. */
export function isAdminRole(role: UserRole | string | null | undefined): boolean {
  return role === "owner_admin" || role === "super_admin"
}

/** True only for the platform owner role. Use this for the few
 *  surfaces reserved to the founder (e.g. inviting another admin). */
export function isSuperAdminRole(role: UserRole | string | null | undefined): boolean {
  return role === "super_admin"
}

/** Short Spanish (voseo CR) label suitable for badges and tables. */
export function getRoleLabelEs(role: UserRole | string | null | undefined): string {
  if (role === "super_admin") return "Super admin"
  if (role === "owner_admin") return "Admin"
  return "Agente"
}

/** Short English label — mirrors the ES version for parity. */
export function getRoleLabelEn(role: UserRole | string | null | undefined): string {
  if (role === "super_admin") return "Super admin"
  if (role === "owner_admin") return "Admin"
  return "Agent"
}
