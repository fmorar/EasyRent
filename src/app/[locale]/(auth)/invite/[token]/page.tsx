import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import AcceptInviteForm from "./accept-invite-form"
import { EasyrentLogo } from "@/components/shared/easyrent-logo"

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

  // The auth layout is now transparent — each page owns its chrome.
  // We keep the invite flow's centred-card look, with the brand
  // wordmark above so the user knows where they are.
  return (
    <div className="min-h-screen bg-muted/40 flex items-center justify-center p-(--spacing-cluster)">
      <div className="w-full max-w-md">
        <div className="text-center mb-(--spacing-block) space-y-(--spacing-tight) flex flex-col items-center">
          <EasyrentLogo className="h-7 w-auto text-foreground" />
          <p className="text-sm text-muted-foreground">Private Real Estate Operations</p>
        </div>
        <AcceptInviteForm invitation={invitation} token={token} />
      </div>
    </div>
  )
}
