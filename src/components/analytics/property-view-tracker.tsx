"use client"

import { useEffect } from "react"
import { trackEvent } from "@/lib/analytics/track"

interface Props {
  propertyId: string
  /** "branded" for /p/[slug] — "anonymous" for /p/a/[anonymousSlug] */
  variant:    "branded" | "anonymous"
}

/**
 * Mounts once on the public property page and fires `property_viewed`
 * after a tiny delay (so SSR-then-rehydrate doesn't double-count and
 * so we skip drive-by bounces under 500ms).
 *
 * Anonymous link variants also fire `anonymous_link_viewed` so the
 * report can split organic vs unbranded share traffic.
 */
export function PropertyViewTracker({ propertyId, variant }: Props) {
  useEffect(() => {
    // Drive-by guard: 500ms minimum dwell. If the user bounces faster
    // than that the timeout never fires.
    const t = window.setTimeout(() => {
      trackEvent({
        property_id: propertyId,
        event_type:  "property_viewed",
        source:      variant,
      })
      if (variant === "anonymous") {
        trackEvent({
          property_id: propertyId,
          event_type:  "anonymous_link_viewed",
          source:      "anonymous",
        })
      }

      // Deep-engagement signal once the visitor scrolls past 75% of
      // the document. We listen ONCE then detach.
      let fired = false
      const onScroll = () => {
        if (fired) return
        const doc = document.documentElement
        const max = doc.scrollHeight - window.innerHeight
        if (max <= 0) return
        const pct = (window.scrollY / max) * 100
        if (pct >= 75) {
          fired = true
          window.removeEventListener("scroll", onScroll)
          trackEvent({
            property_id: propertyId,
            event_type:  "deep_engagement",
            source:      variant,
            metadata:    { scroll_pct: Math.round(pct) },
          })
        }
      }
      window.addEventListener("scroll", onScroll, { passive: true })

      // Cleanup if unmounts before scroll happens
      return () => window.removeEventListener("scroll", onScroll)
    }, 500)

    return () => window.clearTimeout(t)
  }, [propertyId, variant])

  return null
}
