import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

// Service-role client — bypasses RLS entirely.
// SERVER ONLY — never import this in client components or expose to the browser.
// Used for: lead capture (public forms), invitation acceptance, admin operations.
export function createAdminClient() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
    )
  }

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken:  false,
      persistSession:    false,
    },
  })
}
