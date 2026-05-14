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
 * Convert a Supabase Storage public URL into its on-the-fly thumbnail
 * URL. Pass-through for anything that isn't a Supabase URL (so
 * external sources like Google Places avatars keep working).
 *
 * The 2× multiplier on width/height keeps things sharp on retina
 * displays without an explicit srcset.
 */
export function supabaseThumbnail(
  url: string | null | undefined,
  opts: Opts,
): string | undefined {
  if (!url) return undefined

  // Only rewrite our own Supabase URLs. Anything else (Google avatars,
  // Unsplash, etc.) gets returned as-is.
  const isSupabase = /supabase\.co\/storage\/v1\/object\/public\//.test(url)
  if (!isSupabase) return url

  // Strip any existing query string — we don't want to compound
  // cache-busting `?v=…` values with our resize params (Supabase
  // returns 400 on conflicting keys).
  const [base] = url.split("?")
  const rendered = base!.replace(
    "/storage/v1/object/public/",
    "/storage/v1/render/image/public/",
  )

  const params = new URLSearchParams()
  // Double up for HiDPI without resorting to srcset on the consumer.
  params.set("width",  String(opts.width  * 2))
  if (opts.height) params.set("height", String(opts.height * 2))
  params.set("resize",  opts.resize  ?? "cover")
  params.set("quality", String(opts.quality ?? 75))

  return `${rendered}?${params.toString()}`
}
