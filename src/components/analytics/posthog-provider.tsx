"use client"

import { Suspense, useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import type posthogType from "posthog-js"

const POSTHOG_KEY  = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com"

// Module-level singleton — once we kick off the deferred import, every
// component that needs the client awaits the same promise. Keeps us
// from racing parallel imports across PageviewTracker and the root.
let posthogPromise: Promise<typeof posthogType> | null = null

function loadPosthog(): Promise<typeof posthogType> {
  if (posthogPromise) return posthogPromise
  if (typeof window === "undefined" || !POSTHOG_KEY) {
    posthogPromise = Promise.reject(new Error("posthog disabled"))
    return posthogPromise
  }
  posthogPromise = import("posthog-js").then(({ default: posthog }) => {
    posthog.init(POSTHOG_KEY!, {
      api_host:           POSTHOG_HOST,
      capture_pageview:   false,             // we fire manually on route change
      capture_pageleave:  true,
      person_profiles:    "identified_only", // privacy: no anon profiles
      autocapture:        true,
      session_recording:  { maskAllInputs: true, maskTextSelector: "[data-ph-mask]" },
      mask_personal_data_properties: true,
      // Disable PostHog product features we don't use. Each one ships
      // its own chunk (surveys, exception autocapture, web vitals,
      // toolbar) and PostHog loads them eagerly unless explicitly off.
      disable_surveys:               true,
      disable_session_recording:     false,
      capture_exceptions:            false,
      capture_performance:           false,
    })
    return posthog
  })
  return posthogPromise
}

/**
 * PostHog wrapper for product analytics — INTERNAL use only.
 *
 * ── Perf strategy ─────────────────────────────────────────────────
 * `posthog-js` is ~190 KB of JS. Loading it eagerly on the landing
 * page was the single biggest INP offender (real-user P75 INP was
 * 1.9 s on mobile). We now defer the SDK import until either:
 *   • the visitor's first interaction (pointer/key/scroll/touch), OR
 *   • `requestIdleCallback` after a 2.5 s safety timeout
 * whichever comes first. The landing pageview is fired the moment
 * the SDK finishes booting, so we don't lose the arrival event.
 *
 * We intentionally do NOT wrap children in the `posthog-js/react`
 * `<PostHogProvider>` here. No component in this codebase calls
 * `usePostHog()` (verified via grep) — analytics flow exclusively
 * through `posthog.capture(...)` on the module singleton, which works
 * fine without the Provider. Skipping it lets the dashboard pages
 * never pay the cost of an extra 12 KB of React glue.
 *
 * Env required (set in Vercel + .env.local when ready):
 *   NEXT_PUBLIC_POSTHOG_KEY=phc_...
 *   NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com   (optional)
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!POSTHOG_KEY) return
    if (typeof window === "undefined") return

    let cancelled = false
    const fire = () => {
      if (cancelled) return
      loadPosthog().then((posthog) => {
        if (cancelled) return
        // Landing pageview — same data PostHog's `capture_pageview` flag
        // would have sent on init, just timed off the critical path.
        posthog.capture("$pageview", {
          $current_url: window.location.pathname + window.location.search,
        })
      }).catch(() => { /* swallow — SDK was disabled */ })
    }

    // Trigger A — first interaction. Keeps the SDK off INP's critical
    // path: by definition INP only counts post-interaction, so loading
    // posthog DURING that first interaction overlaps with work the
    // user already accepts as "responding".
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "scroll", "touchstart"]
    const onInteract = () => fire()
    for (const e of events) window.addEventListener(e, onInteract, { once: true, passive: true })

    // Trigger B — idle fallback for bots / background tabs / hard
    // bounces so pageview metrics aren't biased to engaged sessions.
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?:  (handle: number) => void
    }
    const idleHandle =
      typeof w.requestIdleCallback === "function"
        ? w.requestIdleCallback(fire, { timeout: 4000 })
        : window.setTimeout(fire, 2500)

    return () => {
      cancelled = true
      for (const e of events) window.removeEventListener(e, onInteract)
      if (typeof w.cancelIdleCallback === "function") w.cancelIdleCallback(idleHandle)
      else window.clearTimeout(idleHandle)
    }
  }, [])

  return (
    <>
      {children}
      {/* useSearchParams() requires a Suspense boundary in Next.js 16
          for pages that opt into static generation. */}
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
    </>
  )
}

// PageviewTracker — SPA route-change pageview capture. We only fire
// AFTER the first navigation (the initial landing pageview is fired by
// the parent's deferred-load path). This avoids double-counting the
// arrival and keeps capture costs idle on first paint.
function PageviewTracker() {
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const firstRender  = useRef(true)

  useEffect(() => {
    if (!POSTHOG_KEY || !pathname) return
    if (firstRender.current) {
      // The landing pageview is owned by PostHogProvider's effect.
      firstRender.current = false
      return
    }
    let cancelled = false
    loadPosthog().then((posthog) => {
      if (cancelled) return
      const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "")
      posthog.capture("$pageview", { $current_url: url })
    }).catch(() => { /* swallow */ })
    return () => { cancelled = true }
  }, [pathname, searchParams])

  return null
}
