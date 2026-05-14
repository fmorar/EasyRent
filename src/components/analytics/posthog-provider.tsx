"use client"

import { Suspense, useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import posthog from "posthog-js"
import { PostHogProvider as Provider } from "posthog-js/react"

const POSTHOG_KEY  = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com"

let initialized = false

/**
 * PostHog wrapper for product analytics — INTERNAL use only.
 *
 * Goal: understand how the team and visitors use the product
 * (funnels, retention, session recordings of the dashboard).
 *
 * NOT a replacement for the owner-facing report data — that lives
 * in `property_analytics_events` in our DB. PostHog runs in
 * parallel as a mirror so the dashboard team has a UI for funnels
 * without us having to build one.
 *
 * Defaults:
 *   - autocapture ON (clicks + pageviews + form submits)
 *   - person_profiles="identified_only" so we DON'T create a Person
 *     for anonymous visitors. Saves quota + reduces PII surface.
 *   - capture_pageview="manual" — we fire pageviews ourselves on
 *     route change so SPA navigations are counted accurately.
 *
 * Env required (set in Vercel + .env.local when ready):
 *   NEXT_PUBLIC_POSTHOG_KEY=phc_...
 *   NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com   (optional)
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!POSTHOG_KEY) return                  // gracefully no-op when unconfigured
    if (initialized) return
    initialized = true

    posthog.init(POSTHOG_KEY, {
      api_host:           POSTHOG_HOST,
      capture_pageview:   false,             // we fire manually on route change
      capture_pageleave:  true,
      person_profiles:    "identified_only", // privacy: no anon profiles
      autocapture:        true,
      session_recording:  { maskAllInputs: true, maskTextSelector: "[data-ph-mask]" },
      // Mark sensitive attributes so PostHog auto-masks them.
      mask_personal_data_properties: true,
      // Disable PostHog product features we don't use. Each one ships
      // its own chunk (surveys, exception autocapture, web vitals,
      // toolbar) and PostHog loads them eagerly unless explicitly
      // turned off. PageSpeed flagged surveys.js as 27 KiB of
      // unused JS — these flags shed it.
      disable_surveys:               true,
      disable_session_recording:     false,  // we do use this
      capture_exceptions:            false,
      capture_performance:           false,
    })
  }, [])

  return (
    <Provider client={posthog}>
      {children}
      {/* useSearchParams() requires a Suspense boundary in Next.js 16
          for pages that opt into static generation (notably /_not-found). */}
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
    </Provider>
  )
}

// PostHog won't auto-fire pageviews on App Router navigations — we hook
// into pathname + searchParams and capture on every change.
function PageviewTracker() {
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!POSTHOG_KEY || !pathname) return
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "")
    posthog.capture("$pageview", { $current_url: url })
  }, [pathname, searchParams])

  return null
}
