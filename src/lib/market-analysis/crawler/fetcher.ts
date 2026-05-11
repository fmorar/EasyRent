// ============================================================
// HTTP Fetcher — robots.txt aware, rate-limited, polite
//
// Centralized to keep adapters pure (no network, just parsing).
// All outbound requests share:
//   • a single User-Agent that identifies our service
//   • a per-host rate limiter (1 req/sec)
//   • a 12s timeout
//   • robots.txt check (best-effort — failure to fetch = allow)
//
// We do NOT bypass captchas, JS challenges, or login walls. If a
// page returns 403/429/503, the crawler marks the source as failed.
// ============================================================

const USER_AGENT = "re-platform-market-analysis/1.0 (+contact: ops@re-platform.local)"

const robotsCache  = new Map<string, RobotsRules>()
const lastCallByHost = new Map<string, number>()

interface RobotsRules {
  disallowedPrefixes: string[]
  crawlDelayMs:       number
}

export class FetcherBlockedError extends Error {
  constructor(public reason: "robots" | "http_status" | "timeout", message: string) {
    super(message)
    this.name = "FetcherBlockedError"
  }
}

export async function fetchHtml(url: string): Promise<string> {
  const u = new URL(url)
  await throttle(u.host)
  await ensureAllowedByRobots(u)

  let res: Response
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent":      USER_AGENT,
        "Accept":          "text/html,application/xhtml+xml",
        "Accept-Language": "es,en;q=0.8",
      },
      redirect: "follow",
      signal:   AbortSignal.timeout(12_000),
    })
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new FetcherBlockedError("timeout", `Timed out fetching ${url}`)
    }
    throw err
  }

  if (res.status === 403 || res.status === 429 || res.status === 503) {
    throw new FetcherBlockedError("http_status", `Source returned ${res.status} — likely rate-limited or blocked.`)
  }
  if (!res.ok) {
    throw new FetcherBlockedError("http_status", `HTTP ${res.status} fetching ${url}`)
  }

  return res.text()
}

// ── Throttle ─────────────────────────────────────────────────────
async function throttle(host: string) {
  const last = lastCallByHost.get(host) ?? 0
  const wait = Math.max(0, 1000 - (Date.now() - last))
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCallByHost.set(host, Date.now())
}

// ── robots.txt ───────────────────────────────────────────────────
async function ensureAllowedByRobots(u: URL) {
  const origin = `${u.protocol}//${u.host}`
  let rules = robotsCache.get(origin)

  if (!rules) {
    rules = await loadRobots(origin)
    robotsCache.set(origin, rules)
  }

  const path = u.pathname + (u.search ?? "")
  const blocked = rules.disallowedPrefixes.some((prefix) => path.startsWith(prefix))
  if (blocked) {
    throw new FetcherBlockedError("robots", `robots.txt disallows ${path}`)
  }
}

async function loadRobots(origin: string): Promise<RobotsRules> {
  const empty: RobotsRules = { disallowedPrefixes: [], crawlDelayMs: 0 }
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": USER_AGENT },
      signal:  AbortSignal.timeout(5000),
    })
    if (!res.ok) return empty
    const text = await res.text()
    return parseRobots(text)
  } catch {
    return empty
  }
}

/**
 * Minimal robots.txt parser. We respect:
 *   • the wildcard group `User-agent: *`
 *   • a group matching our UA's prefix
 * If both exist, our UA-specific group wins.
 *
 * `Disallow:` with empty value = allow everything (per spec).
 */
function parseRobots(text: string): RobotsRules {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim()).filter(Boolean)
  let currentUAs: string[] = []
  const groups: Record<string, { disallow: string[]; delay: number }> = {}

  for (const line of lines) {
    const idx = line.indexOf(":")
    if (idx < 0) continue
    const key = line.slice(0, idx).trim().toLowerCase()
    const val = line.slice(idx + 1).trim()

    if (key === "user-agent") {
      currentUAs = [val.toLowerCase()]
      groups[val.toLowerCase()] ??= { disallow: [], delay: 0 }
    } else if (key === "disallow") {
      for (const ua of currentUAs) {
        groups[ua] ??= { disallow: [], delay: 0 }
        if (val.length > 0) groups[ua].disallow.push(val)
      }
    } else if (key === "crawl-delay") {
      const n = parseFloat(val)
      if (Number.isFinite(n)) {
        for (const ua of currentUAs) {
          groups[ua] ??= { disallow: [], delay: 0 }
          groups[ua].delay = Math.max(groups[ua].delay, n * 1000)
        }
      }
    }
  }

  // Prefer a UA-specific group, else fallback to wildcard.
  const myUaToken = "re-platform-market-analysis"
  const uaKey = Object.keys(groups).find((k) => k.includes(myUaToken)) ?? "*"
  const matched = groups[uaKey] ?? groups["*"] ?? { disallow: [], delay: 0 }

  return {
    disallowedPrefixes: matched.disallow,
    crawlDelayMs:       matched.delay,
  }
}

export const FETCHER_USER_AGENT = USER_AGENT
