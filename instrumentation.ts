// ============================================================
// Sentry — server + edge instrumentation (Next 16, Sentry v10)
//
// Loaded automatically by Next.js at the start of the server / edge
// runtime, before any route handler executes.
//
// Privacy:
//   - sendDefaultPii: false (no IP / cookies / user-agent attached
//     to events automatically)
//   - tracesSampleRate kept low (10% server, 5% edge)
//   - No Replays here; the client config decides what to record.
//
// No-ops gracefully when SENTRY_DSN is unset (local dev).
// ============================================================

export async function register() {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs")
    Sentry.init({
      dsn,
      environment:      process.env.VERCEL_ENV ?? "development",
      tracesSampleRate: 0.1,
      sendDefaultPii:   false,
    })
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs")
    Sentry.init({
      dsn,
      environment:      process.env.VERCEL_ENV ?? "development",
      tracesSampleRate: 0.05,
      sendDefaultPii:   false,
    })
  }
}

// Forwards request errors from React Server Components to Sentry.
export const onRequestError = (() => {
  const dsnPresent = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsnPresent) return undefined
  // Lazy require so the bundle doesn't pull Sentry when DSN missing.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@sentry/nextjs").captureRequestError as
    | ((err: unknown, req: Request, ctx: unknown) => void | Promise<void>)
    | undefined
})()
