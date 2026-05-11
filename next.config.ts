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
}

export default withNextIntl(nextConfig)
