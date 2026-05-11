"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { slugify } from "@/lib/utils"
import type { ActionResult } from "@/types"

interface InviteInput {
  email:  string
  role?:  "agent" | "owner_admin"
  /** Zones to pre-assign — applied to the new profile on accept. */
  zones?: string[]
}

export async function inviteAgent(
  input: InviteInput
): Promise<ActionResult<{ token: string }>> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()
  const admin       = createAdminClient()

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
      role:        input.role  ?? "agent",
      zones:       input.zones ?? [],
    })
    .select("token")
    .single()

  if (error) return { success: false, error: error.message }

  // TODO: Send invitation email via your email provider (Resend, Postmark, etc.)
  // The invite URL is: `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invitation.token}`

  revalidatePath("/agents")
  return { success: true, data: { token: invitation.token } }
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

  // Sign in the new user automatically
  // The client-side form will use signInWithPassword after this action succeeds.

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
