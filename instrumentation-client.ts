// ============================================================
// Sentry — client-side instrumentation
//
// Auto-loaded by Next 16 in the browser bundle. Replays are
// disabled by default to avoid recording sensitive lead data
// shown on the dashboard. Enable per-route on demand if needed.
// ============================================================

import * as Sentry from "@sentry/nextjs"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment:      process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    tracesSampleRate: 0.1,
    sendDefaultPii:   false,
    beforeSend(event) {
      // Strip request/user PII that may leak through default integrations.
      if (event.request?.headers) {
        delete event.request.headers["cookie"]
        delete event.request.headers["authorization"]
      }
      if (event.user) {
        delete event.user.email
        delete event.user.ip_address
      }
      return event
    },
  })
}

// Required by Next 16 for navigation transactions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const onRouterTransitionStart: any =
  (Sentry as unknown as { captureRouterTransitionStart?: unknown }).captureRouterTransitionStart
