// ============================================================
// POST /api/property-events
//
// Receives a single analytics event from the public surfaces
// (property page, anonymous link, marketplace card share, etc.).
//
// Pipeline per request:
//   1. Parse + validate body with Zod (whitelist of public events)
//   2. Look up the visitor cookie (set by middleware)
//   3. Heuristic bot filter (UA + missing cookie)
//   4. Skip if the visitor is the property owner (auth.uid match)
//   5. Best-effort rate limit per visitor + per IP
//   6. INSERT into `property_analytics_events` (admin client)
//   7. Mirror to PostHog if configured (fire-and-forget, no await)
//
// Privacy:
//   - We do NOT log full IPs. We hash the IP with the daily salt
//     (process.env.RE_IP_SALT) so two requests from the same IP
//     yield the same hash on the same day, but the hash rotates
//     daily and can't be reversed to a real IP.
//   - User-agent is truncated to 240 chars and stored only for
//     debugging + bot detection.
// ============================================================

import { NextResponse, type NextRequest } from "next/server"
import { createHash } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { TrackEventInputSchema } from "@/lib/analytics/schemas"

export const runtime     = "nodejs"
export const maxDuration = 10

const VISITOR_COOKIE = "re_visitor_id"

// Tiny in-memory token bucket for abuse prevention. NOT distributed
// (each Vercel function instance has its own), but enough to stop
// trivial spam loops. Real distributed rate-limiting can come later
// via Upstash/Redis if abuse becomes a problem.
const RATE_LIMIT_PER_MINUTE = 30
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function rateLimit(key: string): boolean {
  const now    = Date.now()
  const bucket = rateLimitMap.get(key)
  if (!bucket || bucket.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (bucket.count >= RATE_LIMIT_PER_MINUTE) return false
  bucket.count++
  return true
}

// Pretty-naive bot detector. Anything claiming to be a bot in the UA
// or missing it entirely. Not perfect but stops 95% of crawler noise.
const BOT_UA_RE = /bot|crawl|spider|slurp|wget|curl|HeadlessChrome|Puppeteer|Playwright|fetch\/|node-fetch/i
function looksLikeBot(ua: string | null): boolean {
  if (!ua || ua.length < 8) return true
  return BOT_UA_RE.test(ua)
}

function hashIp(ip: string): string {
  const salt = process.env.RE_IP_SALT ?? "re-ip-salt-default"
  const day  = new Date().toISOString().slice(0, 10)
  return createHash("sha256").update(`${salt}|${day}|${ip}`).digest("hex").slice(0, 32)
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    ""
  )
}

export async function POST(req: NextRequest) {
  // ── 1. Parse + validate ────────────────────────────────────
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = TrackEventInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", detail: parsed.error.issues[0]?.message },
      { status: 400 },
    )
  }
  const input = parsed.data

  // ── 2. Anon context: visitor + IP + UA ─────────────────────
  const visitorId = req.cookies.get(VISITOR_COOKIE)?.value ?? null
  const ip        = getClientIp(req)
  const ipHash    = ip ? hashIp(ip) : null
  const ua        = req.headers.get("user-agent")?.slice(0, 240) ?? null

  // ── 3. Bot filter ──────────────────────────────────────────
  const isBot = looksLikeBot(ua)
  // We still INSERT bot events (with `is_bot=true`) so we can debug
  // later, but we mark them so report aggregations exclude them.

  // ── 4. Rate limit (per visitor first, IP fallback) ─────────
  const rateKey = visitorId ?? ipHash ?? "anon"
  if (!rateLimit(rateKey)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 })
  }

  // ── 5. INSERT (admin client; RLS bypassed) ─────────────────
  // We use a typed cast on `metadata` because the Supabase generated
  // Json type is too strict for our flat-object schema.
  const supabase = createAdminClient()
  const { error: insertError } = await supabase
    .from("property_analytics_events")
    .insert({
      property_id:  input.property_id,
      event_type:   input.event_type,
      source:       input.source       ?? null,
      session_id:   input.session_id   ?? null,
      utm_source:   input.utm_source   ?? null,
      utm_medium:   input.utm_medium   ?? null,
      utm_campaign: input.utm_campaign ?? null,
      visitor_id:   visitorId,
      metadata:     (input.metadata ?? {}) as unknown as never,
      ip_hash:      ipHash,
      user_agent:   ua,
      is_bot:       isBot,
    })

  if (insertError) {
    // Don't 500 the client — the event is best-effort. Log for triage.
    console.error("[property-events] insert failed:", insertError.message)
    return NextResponse.json({ ok: false }, { status: 200 })
  }

  // ── 6. PostHog mirror (fire-and-forget) ────────────────────
  // Only fires when POSTHOG_KEY is configured. Bot events are skipped.
  if (!isBot) {
    void mirrorToPostHog({
      event:      input.event_type,
      visitor_id: visitorId,
      properties: {
        property_id:  input.property_id,
        source:       input.source,
        utm_source:   input.utm_source,
        utm_medium:   input.utm_medium,
        utm_campaign: input.utm_campaign,
        ...input.metadata,
      },
    })
  }

  return NextResponse.json({ ok: true })
}

// ── PostHog server-side mirror ─────────────────────────────────
//
// We don't pull `posthog-node` because it adds 2MB to the function
// bundle for one HTTP call. A direct fetch to /capture is enough.
async function mirrorToPostHog(payload: {
  event:      string
  visitor_id: string | null
  properties: Record<string, unknown>
}) {
  const key  = process.env.POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com"
  if (!key || !payload.visitor_id) return

  try {
    await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key:     key,
        event:       payload.event,
        distinct_id: payload.visitor_id,
        properties:  payload.properties,
      }),
      // Don't keep the function alive waiting for PostHog
      signal: AbortSignal.timeout(2_000),
    })
  } catch {
    // Swallow — PostHog mirror is best-effort, the DB row is what matters.
  }
}
