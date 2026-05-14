/**
 * Helpers for Supabase Storage's image transformation API.
 *
 * Supabase exposes two endpoints for every public file:
 *
 *   /storage/v1/object/public/...     — original bytes
 *   /storage/v1/render/image/public/.. — transformed (resize/format)
 *
 * Switching to `/render/image/public/` + a `?width=...` query lets us
 * fetch a pre-resized version straight from Supabase, served as WebP
 * by default. That fixes two PageSpeed audits at once:
 *
 *   • "Properly size images" — a 2000×2000 avatar source is no longer
 *     downloaded just to be CSS-scaled to 96×96
 *   • "Serve images in next-gen formats" — WebP is ~30% smaller than
 *     PNG/JPEG for the same perceived quality
 *
 * Use this for surfaces where Next/Image can't help — e.g. Base UI's
 * <AvatarImage>, which spreads its props onto a native <img> element
 * and can't be swapped to next/image without breaking the component.
 *
 * Everywhere else (cards, hero photos, gallery tiles), prefer
 * next/image — that route also gets long-cache + responsive srcset on
 * top of resizing.
 */

interface Opts {
  /** Target rendered width in CSS pixels. We double it for 2× displays. */
  width:    number
  /** Optional explicit height. When omitted, Supabase keeps aspect. */
  height?:  number
  /** "cover" (default — crops to fill), "contain", or "fill". */
  resize?:  "cover" | "contain" | "fill"
  /** 20-100, default 75. */
  quality?: number
}

/**
 * Convert a Supabase Storage public URL into a Vercel-optimized
 * thumbnail URL. Pass-through for non-Supabase sources (Google
 * Places avatars, etc.) so we don't break them.
 *
 * Why route through Vercel's image optimizer (`/_next/image`) instead
 * of hitting Supabase's `/storage/v1/render/image/public/` directly:
 *
 *   • Supabase ships every transformed response with
 *     `Cache-Control: max-age=3600` (1h). Visitors re-download every
 *     hour, which trips the "Use efficient cache lifetimes" audit.
 *   • Vercel's optimizer caches at the CDN with our configured
 *     `images.minimumCacheTTL` (1 year) and serves the browser
 *     `Cache-Control: public, max-age=31536000, immutable`.
 *   • Same WebP/AVIF auto-detection, same edge delivery, and the
 *     image budget gets unified with the rest of next/image.
 *
 * The 2× width multiplier keeps avatars sharp on HiDPI displays
 * without forcing every consumer to manage srcset.
 */
export function supabaseThumbnail(
  url: string | null | undefined,
  opts: Opts,
): string | undefined {
  if (!url) return undefined

  // Only optimize our own Supabase URLs. Anything else passes through.
  const isSupabase = /supabase\.co\/storage\/v1\/object\/public\//.test(url)
  if (!isSupabase) return url

  // Vercel's image optimizer accepts `w` (target width) + `q` (quality).
  // It picks WebP/AVIF based on the Accept header and serves with the
  // long-cache Cache-Control set by our next.config `minimumCacheTTL`.
  //
  // The optimizer rejects widths outside the allowlist (next.config
  // `images.imageSizes` + `images.deviceSizes`) with a 400. We snap
  // up to the nearest allowed value so the helper "just works" for
  // any size a caller passes.
  const targetWidth = nearestImageSize(opts.width * 2)

  const params = new URLSearchParams()
  params.set("url", url)
  params.set("w",   String(targetWidth))
  params.set("q",   String(opts.quality ?? 75))

  return `/_next/image?${params.toString()}`
}

// Vercel's default image-optimizer allowlist (imageSizes + deviceSizes).
// Keep in sync with `next.config.ts` if either array gets overridden.
const ALLOWED_WIDTHS = [
  16, 32, 48, 64, 96, 128, 256, 384,              // imageSizes
  640, 750, 828, 1080, 1200, 1920, 2048, 3840,    // deviceSizes
] as const

function nearestImageSize(target: number): number {
  for (const w of ALLOWED_WIDTHS) {
    if (w >= target) return w
  }
  return ALLOWED_WIDTHS[ALLOWED_WIDTHS.length - 1]!
}
