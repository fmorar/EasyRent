// ============================================================
// Client-side analytics — tiny wrapper around POST /api/property-events
//
// Use from any "use client" component:
//
//   import { trackEvent } from "@/lib/analytics/track"
//   trackEvent({ event_type: "whatsapp_clicked", property_id })
//
// All calls are fire-and-forget (no await needed). The helper:
//   - Picks up `?utm_*` query params from the current URL
//   - Includes a per-tab `session_id` (sessionStorage) so events
//     from the same visit cluster together
//   - Uses `navigator.sendBeacon` when possible so the request
//     survives the page unload (e.g. when a CTA navigates away)
// ============================================================

import type { PublicEventType } from "@/lib/analytics/schemas"

interface TrackInput {
  property_id: string
  event_type:  PublicEventType
  /** Optional context: button label, gallery image index, etc. */
  metadata?:   Record<string, string | number | boolean | null>
  /** Optional override (e.g. `"share_button"` vs `"property_card"`). */
  source?:     string
}

const SESSION_KEY = "re_session_id"

function getSessionId(): string | undefined {
  if (typeof window === "undefined") return undefined
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      // Cheap RFC4122-ish random — uuid lib not needed for an opaque token
      id = `s_${crypto.randomUUID().replace(/-/g, "")}`
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return undefined
  }
}

function readUtm(): {
  utm_source?: string; utm_medium?: string; utm_campaign?: string
} {
  if (typeof window === "undefined") return {}
  try {
    const params = new URLSearchParams(window.location.search)
    return {
      utm_source:   params.get("utm_source")   ?? undefined,
      utm_medium:   params.get("utm_medium")   ?? undefined,
      utm_campaign: params.get("utm_campaign") ?? undefined,
    }
  } catch {
    return {}
  }
}

export function trackEvent(input: TrackInput): void {
  if (typeof window === "undefined") return

  const body = JSON.stringify({
    property_id: input.property_id,
    event_type:  input.event_type,
    source:      input.source,
    session_id:  getSessionId(),
    metadata:    input.metadata,
    ...readUtm(),
  })

  // sendBeacon is the right tool for tracking on click+navigate —
  // it queues the request to the browser and lets the page unload.
  // Falls back to fetch for older Safari and dev tooling.
  try {
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const blob = new Blob([body], { type: "application/json" })
      const ok   = navigator.sendBeacon("/api/property-events", blob)
      if (ok) return
    }
  } catch { /* fall through to fetch */ }

  void fetch("/api/property-events", {
    method:      "POST",
    headers:     { "Content-Type": "application/json" },
    body,
    keepalive:   true,
    credentials: "same-origin",
  }).catch(() => { /* swallow */ })
}
