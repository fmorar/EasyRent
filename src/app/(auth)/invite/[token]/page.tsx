import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import AcceptInviteForm from "./accept-invite-form"

interface Props {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params
  const admin = createAdminClient()

  // Validate the invitation server-side before rendering the form
  const { data: invitation, error } = await admin
    .from("invitations")
    .select("id, email, role, status, expires_at")
    .eq("token", token)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .single()

  if (error || !invitation) {
    notFound()
  }

  return <AcceptInviteForm invitation={invitation} token={token} />
}
