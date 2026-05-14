// `/robots.txt` — generated dynamically so we can point at the
// canonical sitemap and disallow dashboard/admin surfaces.

import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL
    ?? process.env.NEXT_PUBLIC_APP_URL
    ?? "https://www.easyrent.house"
  ).replace(/\/+$/, "")
  return {
    rules: [
      {
        userAgent: "*",
        allow:     "/",
        disallow: [
          "/api/",
          "/dashboard/",
          "/login",
          "/p/a/",          // unbranded anonymous property links
          "/reports/",      // private market / performance reports
          "/invite/",       // single-use invite links
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host:    baseUrl,
  }
}
