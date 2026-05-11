// PKCE callback handler.
//
// Supabase's password-recovery email (and other email-based flows like
// magic links / signup confirmation) sends users to this route with a
// short-lived `?code=...` param. We exchange that code for a session
// cookie and redirect them to the page they were trying to reach
// (`?next=…`, with sane defaults).
//
// The route lives under `/api/auth/callback` rather than inside the
// `[locale]` segment so it bypasses next-intl's locale middleware —
// Supabase doesn't know about our locale prefix and we don't want a
// locale rewrite to happen mid-redirect.

import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { routing } from "@/i18n/routing"

// Allow these `next` paths only — prevents open-redirect abuse.
const ALLOWED_NEXT = new Set<string>([
  "/login/reset",
  "/dashboard",
])

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code     = searchParams.get("code")
  const nextRaw  = searchParams.get("next") ?? "/login/reset"
  const errorRaw = searchParams.get("error_description")

  // Resolve locale: the email link doesn't carry the locale, so we read
  // the cookie next-intl sets, falling back to the default.
  const localeCookie = request.cookies.get("NEXT_LOCALE")?.value
  const locale = (
    localeCookie && (routing.locales as readonly string[]).includes(localeCookie)
      ? localeCookie
      : routing.defaultLocale
  )

  // Whitelist the destination — defend against open redirects.
  const next = ALLOWED_NEXT.has(nextRaw) ? nextRaw : "/login/reset"

  // Surface upstream errors (e.g. expired link) on the forgot page.
  if (errorRaw) {
    const url = new URL(`/${locale}/login/forgot`, origin)
    url.searchParams.set("error", errorRaw)
    return NextResponse.redirect(url)
  }

  if (!code) {
    const url = new URL(`/${locale}/login/forgot`, origin)
    url.searchParams.set("error", "Falta el código de recuperación.")
    return NextResponse.redirect(url)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const url = new URL(`/${locale}/login/forgot`, origin)
    url.searchParams.set("error", error.message)
    return NextResponse.redirect(url)
  }

  // Success — drop them on the locale-prefixed destination.
  return NextResponse.redirect(new URL(`/${locale}${next}`, origin))
}
