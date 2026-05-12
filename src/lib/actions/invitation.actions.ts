"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { slugify } from "@/lib/utils"
import { sendAgentInvitationEmail } from "@/lib/email/send-agent-invitation"
import type { ActionResult } from "@/types"

function roleLabel(role: "agent" | "owner_admin"): string {
  return role === "owner_admin" ? "Administrador/a" : "Agente"
}

function inviteUrl(token: string): string {
  // Falls back to localhost so dev sends a working link even when
  // NEXT_PUBLIC_APP_URL is unset.
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  return `${base.replace(/\/$/, "")}/invite/${token}`
}

interface InviteInput {
  email:  string
  role?:  "agent" | "owner_admin"
  /** Zones to pre-assign — applied to the new profile on accept. */
  zones?: string[]
}

/**
 * Authoritative check for who can invite whom. UI dropdowns mirror this
 * but never trust them — the server makes the final call.
 *
 *   super_admin → agent | owner_admin
 *   owner_admin → agent
 *   agent       → agent
 *
 * Nobody can mint another super_admin via the invite flow.
 */
function canInviteRole(
  inviterRole: string,
  requestedRole: "agent" | "owner_admin",
): boolean {
  if (requestedRole === "owner_admin") return inviterRole === "super_admin"
  if (requestedRole === "agent")       return inviterRole === "super_admin"
                                         || inviterRole === "owner_admin"
                                         || inviterRole === "agent"
  return false
}

export async function inviteAgent(
  input: InviteInput
): Promise<ActionResult<{ token: string; emailSent: boolean; emailError?: string }>> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()
  const admin       = createAdminClient()

  const role = input.role ?? "agent"

  if (!canInviteRole(profile.role, role)) {
    return {
      success: false,
      error:   role === "owner_admin"
        ? "Solo el super admin puede invitar a otros administradores."
        : "No tenés permiso para invitar con ese rol.",
    }
  }

  // Check for existing active invitation for this email
  const { data: existing } = await supabase
    .from("invitations")
    .select("id")
    .eq("email",  input.email)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .single()

  if (existing) {
    return { success: false, error: "An active invitation already exists for this email" }
  }
  const { data: invitation, error } = await admin
    .from("invitations")
    .insert({
      email:       input.email,
      invited_by:  profile.id,
      role,
      zones:       input.zones ?? [],
    })
    .select("token, expires_at")
    .single()

  if (error) return { success: false, error: error.message }

  // Send the invitation email — non-blocking on failure so the admin
  // can still grab the link and resend manually from the table.
  const send = await sendAgentInvitationEmail({
    to:          input.email,
    inviterName: profile.full_name,
    roleLabel:   roleLabel(role),
    acceptUrl:   inviteUrl(invitation.token),
    expiresAt:   invitation.expires_at,
  })

  revalidatePath("/agents")
  return {
    success: true,
    data: {
      token:      invitation.token,
      emailSent:  send.sent,
      emailError: send.error,
    },
  }
}

interface AcceptInput {
  token:     string
  full_name: string
  password:  string
}

export async function acceptInvitation(
  input: AcceptInput
): Promise<ActionResult<{ user_id: string }>> {
  const admin = createAdminClient()

  // Validate token
  const { data: invitation, error: invError } = await admin
    .from("invitations")
    .select("*")
    .eq("token",  input.token)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .single()

  if (invError || !invitation) {
    return { success: false, error: "Invalid or expired invitation link" }
  }

  const slug = `${slugify(input.full_name)}-${invitation.id.slice(0, 6)}`

  // Create the auth user — the handle_new_user() DB trigger creates the
  // profile and applies the inviter-assigned zones via the metadata.
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email:             invitation.email,
    password:          input.password,
    email_confirm:     true,
    user_metadata: {
      full_name:     input.full_name,
      slug,
      role:          invitation.role,
      invited_by:    invitation.invited_by,
      zones:         invitation.zones ?? [],
    },
  })

  if (authError) return { success: false, error: authError.message }

  // Mark the invitation as accepted so the admin list stops showing it
  // as "pendiente" once the user actually completes the flow. We never
  // fail the whole accept for this — the auth user already exists, and
  // the admin can still see the user via /agents. Just log and move on.
  const { error: updateErr } = await admin
    .from("invitations")
    .update({
      status:      "accepted",
      accepted_at: new Date().toISOString(),
      accepted_by: authData.user.id,
    })
    .eq("id", invitation.id)

  if (updateErr) {
    console.error("[acceptInvitation] failed to mark invitation accepted:", updateErr)
  }

  // The client-side form runs signInWithPassword right after this returns
  // so the new user lands on /dashboard already authenticated.
  return { success: true, data: { user_id: authData.user.id } }
}

export async function revokeInvitation(
  invitationId: string
): Promise<ActionResult> {
  const { profile } = await requireAuth()

  if (profile.role !== "owner_admin") {
    return { success: false, error: "Only admins can revoke invitations" }
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from("invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId)

  if (error) return { success: false, error: error.message }

  revalidatePath("/agents")
  return { success: true, data: undefined }
}

/**
 * Re-send the invitation email for an existing pending invitation. Used
 * from the admin invitations table when the first send failed or the
 * recipient lost the original message. Does not touch the DB row.
 */
export async function resendInvitation(
  invitationId: string
): Promise<ActionResult<{ emailSent: boolean; emailError?: string }>> {
  const { profile } = await requireAuth()
  const admin = createAdminClient()

  const { data: invitation, error } = await admin
    .from("invitations")
    .select(`
      email, role, status, token, expires_at,
      inviter:profiles!invitations_invited_by_fkey(full_name)
    `)
    .eq("id", invitationId)
    .single<{
      email:      string
      role:       "agent" | "owner_admin"
      status:     string
      token:      string
      expires_at: string
      inviter:    { full_name: string } | null
    }>()

  if (error || !invitation) {
    return { success: false, error: "Invitación no encontrada" }
  }
  if (invitation.status !== "pending") {
    return { success: false, error: "Solo se pueden reenviar invitaciones pendientes" }
  }
  if (new Date(invitation.expires_at) < new Date()) {
    return { success: false, error: "Esta invitación ya venció. Generá una nueva." }
  }

  const send = await sendAgentInvitationEmail({
    to:          invitation.email,
    inviterName: invitation.inviter?.full_name ?? profile.full_name,
    roleLabel:   roleLabel(invitation.role),
    acceptUrl:   inviteUrl(invitation.token),
    expiresAt:   invitation.expires_at,
  })

  return {
    success: true,
    data: { emailSent: send.sent, emailError: send.error },
  }
}

/**
 * Unlink an agent the current user previously invited. Removes the
 * downstream relationship without deleting the agent's account or the
 * properties they own.
 *
 * After unlinking:
 *   • Property shares between me and the agent (in BOTH directions) are
 *     revoked so neither party can see the other's shared inventory.
 *   • Project shares from my projects to the agent and from the agent's
 *     projects to me are removed.
 *   • profiles.invited_by on the agent is cleared so they stop showing
 *     in my network surfaces (sharing pickers, /agents table).
 *   • The agent keeps their own properties / contracts / reports.
 *
 * Only the original inviter can unlink. We never let an arbitrary user
 * break someone else's relationship.
 */
export async function unlinkAgent(
  agentId: string,
): Promise<ActionResult<{ revokedShares: number }>> {
  const { profile } = await requireAuth()
  const admin       = createAdminClient()

  if (agentId === profile.id) {
    return { success: false, error: "No podés desvincularte a vos mismo." }
  }

  // Permission check: only the inviter can unlink.
  const { data: agent, error: agentErr } = await admin
    .from("profiles")
    .select("id, invited_by, email")
    .eq("id", agentId)
    .is("deleted_at", null)
    .maybeSingle()

  if (agentErr || !agent) {
    return { success: false, error: "Agente no encontrado." }
  }
  if (agent.invited_by !== profile.id) {
    return {
      success: false,
      error: "Solo quien invitó al agente puede desvincularlo.",
    }
  }

  // 1) Property shares — revoke in both directions. We use update +
  //    status='revoked' rather than delete so the audit trail survives.
  const nowIso = new Date().toISOString()
  const { error: pShareErr, count: pRevoked } = await admin
    .from("property_shares")
    .update({ status: "revoked", updated_at: nowIso }, { count: "exact" })
    .or(`and(shared_by.eq.${profile.id},shared_with.eq.${agentId}),and(shared_by.eq.${agentId},shared_with.eq.${profile.id})`)
    .neq("status", "revoked")
    .is("deleted_at", null)

  if (pShareErr) return { success: false, error: pShareErr.message }

  // 2) Project shares — schema has (project_id, shared_with), no
  //    explicit shared_by, so we filter by project ownership.
  const { data: myProjectIds } = await admin
    .from("projects")
    .select("id")
    .eq("created_by", profile.id)
    .is("deleted_at", null)
  const { data: agentProjectIds } = await admin
    .from("projects")
    .select("id")
    .eq("created_by", agentId)
    .is("deleted_at", null)

  const myProjIds    = (myProjectIds   ?? []).map((r) => r.id)
  const agentProjIds = (agentProjectIds ?? []).map((r) => r.id)

  if (myProjIds.length > 0) {
    await admin
      .from("project_shares")
      .delete()
      .in("project_id", myProjIds)
      .eq("shared_with", agentId)
  }
  if (agentProjIds.length > 0) {
    await admin
      .from("project_shares")
      .delete()
      .in("project_id", agentProjIds)
      .eq("shared_with", profile.id)
  }

  // 3) Break the network membership.
  const { error: profErr } = await admin
    .from("profiles")
    .update({ invited_by: null })
    .eq("id", agentId)

  if (profErr) return { success: false, error: profErr.message }

  revalidatePath("/agents")
  revalidatePath("/properties")
  revalidatePath("/projects")
  return { success: true, data: { revokedShares: pRevoked ?? 0 } }
}
