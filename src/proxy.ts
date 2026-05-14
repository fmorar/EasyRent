import createIntlMiddleware from "next-intl/middleware"
import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { nanoid } from "nanoid"
import { routing } from "./i18n/routing"

const intlMiddleware = createIntlMiddleware(routing)

// First-party visitor cookie. Used by `/api/property-events` to count
// unique visitors and bind a session of events together. Random,
// anonymous, never tied to PII server-side. 1-year lifetime so we get
// stable "unique" counts month over month.
const VISITOR_COOKIE = "re_visitor_id"
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/properties",
  "/projects",
  "/leads",
  "/contracts",
  "/market-analysis",
  "/performance-reports",
  "/agents",
  "/invitations",
  "/shares",
  "/settings",
]

/**
 * Routes that share a prefix with a protected one but are PUBLIC.
 *
 * Next.js route groups `(public)` and `(dashboard)` don't appear in the
 * URL — both `(public)/projects/[slug]/page.tsx` and
 * `(dashboard)/projects/page.tsx` resolve to URLs starting with
 * `/projects`. The proxy can't tell them apart by path alone, so we
 * explicitly whitelist the public-shape patterns here.
 *
 *   /projects/[slug]   public project detail
 *     (excludes /projects, /projects/new, /projects/[slug]/edit)
 *   /agents/[slug]     public agent profile
 *     (excludes /agents, /agents/invite)
 */
function isPublicWithinProtectedPrefix(path: string): boolean {
  // /projects/<slug> — exactly two segments after the leading slash.
  // Reject the dashboard-only sub-route /projects/new.
  const projectsMatch = /^\/projects\/([^/]+)$/.exec(path)
  if (projectsMatch && projectsMatch[1] !== "new") return true

  // /agents/<slug> — exactly two segments. Reject /agents/invite.
  const agentsMatch = /^\/agents\/([^/]+)$/.exec(path)
  if (agentsMatch && agentsMatch[1] !== "invite") return true

  return false
}

export async function proxy(request: NextRequest) {
  // 1. Handle locale routing first
  const intlResponse = intlMiddleware(request)

  // If next-intl issued a redirect (missing locale), follow it immediately
  if (intlResponse.status === 307 || intlResponse.status === 308) {
    return intlResponse
  }

  // 2. Refresh Supabase session (SSR cookie management)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return intlResponse
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  // Copy over any headers next-intl set (locale cookie etc.)
  intlResponse.headers.forEach((value, key) => {
    response.headers.set(key, value)
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // 3. Auth protection — strip /{locale} prefix to get the real path
  const { pathname } = request.nextUrl
  const segments = pathname.split("/").filter(Boolean)
  const pathWithoutLocale = "/" + segments.slice(1).join("/")
  const locale = segments[0] ?? routing.defaultLocale

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathWithoutLocale === prefix || pathWithoutLocale.startsWith(prefix + "/")
  )
  const isPublicException = isPublicWithinProtectedPrefix(pathWithoutLocale)

  if (isProtected && !isPublicException && !user) {
    const loginUrl = new URL(`/${locale}/login`, request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (pathWithoutLocale === "/login" && user) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url))
  }

  // 4. Anonymous visitor cookie — set ONLY on public surfaces so the
  // dashboard isn't tracked. The cookie has no PII; it's a random id
  // used by `/api/property-events` to count unique visitors.
  // We skip the cookie when the request is authenticated (the visitor
  // is an agent or admin browsing the public marketplace; their views
  // shouldn't inflate owners' counters anyway).
  // Public-within-protected counts as public for tracking too (these
  // are agent profile / project detail visits — public surfaces).
  const isPublicSurface =
    (!isProtected || isPublicException) && pathWithoutLocale !== "/login"
  if (isPublicSurface && !user && !request.cookies.has(VISITOR_COOKIE)) {
    response.cookies.set(VISITOR_COOKIE, nanoid(20), {
      httpOnly: true,
      sameSite: "lax",
      secure:   process.env.NODE_ENV === "production",
      path:     "/",
      maxAge:   VISITOR_COOKIE_MAX_AGE,
    })
  }

  return response
}

export const config = {
  matcher: [
    // Exclude API routes (`/api/*`), Next internals, favicon, static
    // image assets, and Next's special metadata files (robots.txt,
    // sitemap.xml, manifest). API routes must never be locale-prefixed
    // by next-intl — they're framework-agnostic transport.
    //
    // robots.txt + sitemap.xml live at the domain root by convention;
    // Google fetches them at `/robots.txt`, never `/es/robots.txt`.
    // Letting next-intl 307-redirect them to a locale path is exactly
    // the wrong thing to do — search engines won't follow the redirect
    // for these special files and the site ends up uncrawlable.
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
