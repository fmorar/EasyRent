// Reset-password page (server) — runs after `/api/auth/callback`
// has already exchanged the PKCE code and put a session in the
// cookies. We just verify there's a valid recovery session, fetch
// the hero photo, and hand off to the client form.

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getLocale } from "next-intl/server"
import { AuthShell } from "@/components/auth/auth-shell"
import { ResetPasswordForm } from "./reset-password-form"

export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const locale   = await getLocale()

  // No session ⇒ no recovery flow in progress. Send them back to
  // /login/forgot where they can request a fresh link.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/${locale}/login/forgot?error=El%20enlace%20expir%C3%B3.%20Pid%C3%AD%20uno%20nuevo.`)
  }

  // Hero photo — same source as /login.
  const { data: photoRow } = await supabase
    .from("property_photos")
    .select(`url, property:properties!inner(is_marketplace_visible, deleted_at, created_at)`)
    .eq("is_cover", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { url: string } | null }

  return (
    <AuthShell heroImageUrl={photoRow?.url ?? null}>
      <ResetPasswordForm userEmail={user.email ?? null} />
    </AuthShell>
  )
}
