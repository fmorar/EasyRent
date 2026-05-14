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
        // Google Places photo CDN — reviewer avatars and any place
        // photos surfaced on project / agent profiles.
        protocol: "https",
        hostname: "*.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
}

export default withNextIntl(nextConfig)
