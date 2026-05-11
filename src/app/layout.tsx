import type { Metadata } from "next"
import { Inter, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { PostHogProvider } from "@/components/analytics/posthog-provider"
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

export const metadata: Metadata = {
  title:       "easyrent",
  description: "Real estate management platform",
}

// Root layout — minimal shell. Locale-specific layout lives in [locale]/layout.tsx.
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/* suppressHydrationWarning silences mismatches caused by browser
          extensions (Grammarly, LanguageTool, password managers, etc.) that
          inject attributes into the body before React hydrates. */}
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
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
