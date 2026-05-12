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
