import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

const nextConfig: NextConfig = {
  experimental: {
    // Wraps Next's soft router navigations in
    // `document.startViewTransition()`, which lets us morph elements
    // tagged with `view-transition-name` between routes (e.g. the
    // cover photo on a marketplace card morphing into the hero photo
    // on the detail page). Falls back gracefully on browsers without
    // View Transitions API support (Firefox stable).
    viewTransition: true,
  },
  images: {
    // Route external images through Vercel's image optimizer. This
    // gives us three perf wins at once:
    //   • Automatic WebP/AVIF when the client supports it (~25-50%
    //     smaller payloads than the source JPEG/PNG)
    //   • Responsive `srcset` per viewport (phones don't download
    //     desktop-sized originals)
    //   • Aggressive CDN cache with `max-age=31536000, immutable` —
    //     fixes the "Use efficient cache lifetimes" PageSpeed audit
    //     (Supabase Storage ships a 1h max-age that re-downloads
    //     every photo on every visit)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        // Same hostname, transformation endpoint — used by
        // src/lib/supabase-image.ts for on-the-fly avatar resizing.
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/render/image/public/**",
      },
      {
        // Google Places photo CDN — reviewer avatars and any place
        // photos surfaced on project / agent profiles.
        protocol: "https",
        hostname: "*.googleusercontent.com",
        pathname: "/**",
      },
    ],
    // Override Vercel's 60s default. Vercel respects the lower of
    // (source `Cache-Control: max-age`, this TTL). Supabase Storage
    // ships every file with `max-age=3600`, which means without this
    // override repeat visitors re-download every photo every hour.
    // Setting 1 year flips it: Vercel caches the optimized response
    // for 1 year regardless of what Supabase says upstream, and the
    // browser sees `Cache-Control: public, max-age=31536000, immutable`
    // on every `/_next/image` response. Fixes the "Use efficient
    // cache lifetimes" PageSpeed audit at the source.
    minimumCacheTTL: 31536000,
  },
}

export default withNextIntl(nextConfig)
