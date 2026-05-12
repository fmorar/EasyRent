import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getLocale } from "next-intl/server"
import type { Profile } from "@/types"

async function loginRedirect() {
  const locale = await getLocale()
  redirect(`/${locale}/login`)
}

async function dashboardRedirect() {
  const locale = await getLocale()
  redirect(`/${locale}/dashboard`)
}

// Fetch the current session user + their profile.
// Redirects to /{locale}/login if no session.
export async function requireAuth(): Promise<{ userId: string; profile: Profile }> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    await loginRedirect()
    // unreachable — redirect() throws
    throw new Error()
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (profileError || !profile) {
    await loginRedirect()
    throw new Error()
  }

  return { userId: user.id, profile }
}

// Same as requireAuth but asserts the user is either owner_admin or
// super_admin — the two "operational admin" tiers. Use this for pages
// that show management surfaces (shares review, invitations log, etc.)
// without distinguishing between the two.
export async function requireAdmin(): Promise<{ userId: string; profile: Profile }> {
  const result = await requireAuth()

  if (result.profile.role !== "owner_admin" && result.profile.role !== "super_admin") {
    await dashboardRedirect()
    throw new Error()
  }

  return result
}

// Strict gate for super-admin-only features (creating admin users,
// platform audits, etc.). Distinct from requireAdmin which lets
// owner_admin through too.
export async function requireSuperAdmin(): Promise<{ userId: string; profile: Profile }> {
  const result = await requireAuth()

  if (result.profile.role !== "super_admin") {
    await dashboardRedirect()
    throw new Error()
  }

  return result
}

// Returns null if no session — for layouts that support both states.
export async function getOptionalAuth(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  return profile ?? null
}
