// Forgot-password page (server) — fetches the hero photo and hands
// off to the client form. Mirrors `/login/page.tsx`'s pattern.

import { createClient } from "@/lib/supabase/server"
import { AuthShell } from "@/components/auth/auth-shell"
import { ForgotPasswordForm } from "./forgot-password-form"

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error: errorParam } = await searchParams
  const supabase = await createClient()

  // Pull the latest marketplace-visible cover photo as the hero
  // backdrop. Falls back to null → the shell renders a gradient.
  const { data: photoRow } = await supabase
    .from("property_photos")
    .select(`url, property:properties!inner(is_marketplace_visible, deleted_at, created_at)`)
    .eq("is_cover", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { url: string } | null }

  return (
    <AuthShell heroImageUrl={photoRow?.url ?? null}>
      <ForgotPasswordForm initialError={errorParam ?? null} />
    </AuthShell>
  )
}
