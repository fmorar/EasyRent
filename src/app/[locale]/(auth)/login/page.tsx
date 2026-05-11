// Login page (server) — fetches a hero photo to use as the visual
// half of the split-screen layout, then hands off to the client
// component for the actual form logic.
//
// Hero photo strategy: we reuse a marketplace cover (the most
// recently uploaded marketplace-visible property) as a placeholder.
// Replace `heroImageUrl` with a dedicated brand asset when you have
// one; the rest of the page stays the same.

import { createClient } from "@/lib/supabase/server"
import { LoginClient } from "./login-client"

export default async function LoginPage() {
  const supabase = await createClient()

  // Pull the latest marketplace-visible cover photo as a hero
  // placeholder. Falls back to null → the client renders a CSS
  // gradient instead.
  const { data: photoRow } = await supabase
    .from("property_photos")
    .select(`url, property:properties!inner(is_marketplace_visible, deleted_at, created_at)`)
    .eq("is_cover", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { url: string } | null }

  return <LoginClient heroImageUrl={photoRow?.url ?? null} />
}
