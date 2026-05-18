import type { Metadata } from "next"
import { Inter, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { getLocale } from "next-intl/server"
import { PostHogProvider } from "@/components/analytics/posthog-provider"
import { buildOrganizationJsonLd, buildWebSiteJsonLd, jsonLdScript } from "@/lib/seo/json-ld"
import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
  subsets:  ["latin"],
  display:  "swap",
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets:  ["latin"],
  display:  "swap",
})

// Resolved at build/runtime — production should set NEXT_PUBLIC_APP_URL
// to the canonical domain so relative og:image paths in route-level
// metadata point at the right host (WhatsApp, Slack, Telegram etc.
// scrape the rendered absolute URL, not the route-relative one).
//
// `||` (not `??`) on purpose: Vercel's CLI sometimes returns
// sensitive env vars as empty strings via `vercel env pull`, which
// would slip past `??` (only nullish) and crash `new URL("")` at
// module load. `||` covers empty/whitespace too.
const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
  "https://www.easyrent.house"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title:       "easyrent",
  description: "Real estate management platform",
  openGraph: {
    type:        "website",
    siteName:    "easyrent",
    title:       "easyrent",
    description: "Real estate management platform",
    locale:      "es_CR",
  },
  twitter: {
    card:        "summary_large_image",
    title:       "easyrent",
    description: "Real estate management platform",
  },
}

// Root layout — minimal shell. Locale-specific layout lives in [locale]/layout.tsx.
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Read the active locale here so the <html lang> attribute is
  // correct on first render. next-intl resolves the locale from the
  // URL via the middleware-set cookie/header even though this layout
  // sits OUTSIDE the [locale] segment. Without this attribute, screen
  // readers can't determine the page language and Google's lang
  // signal falls back to autodetection (less reliable than explicit).
  const locale = await getLocale()
  return (
    <html
      lang={locale}
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/* suppressHydrationWarning silences mismatches caused by browser
          extensions (Grammarly, LanguageTool, password managers, etc.) that
          inject attributes into the body before React hydrates. */}
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        {/* Schema.org Organization — site-wide brand identity for
            search engines. Drops on every route so the knowledge-panel
            pipeline picks it up regardless of which page a crawler
            enters at. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdScript(buildOrganizationJsonLd(SITE_URL)),
          }}
        />
        {/* WebSite + SearchAction — unlocks the Sitelinks Search Box
            in Google's SERP entry for brand queries. Lives in the root
            layout (single canonical instance — Google flags it as
            duplicate if emitted on sub-pages). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdScript(buildWebSiteJsonLd(SITE_URL)),
          }}
        />
        {/* PostHog wraps the tree so client components can `usePostHog()`.
            On servers without env vars the provider becomes a no-op. */}
        <PostHogProvider>
          {children}
        </PostHogProvider>
        {/* Vercel platform analytics — pageviews, Web Vitals, bot detection.
            Both components are no-ops outside Vercel deployments and don't
            ship cookies, so no consent banner needed. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
