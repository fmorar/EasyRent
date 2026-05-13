// Dynamic sitemap — Next.js picks this up as `/sitemap.xml`.
//
// Coverage:
//   • Static surfaces:  /, /marketplace, /agents, /contacto, /blog, /login
//   • Properties:       every row in `v_marketplace`
//   • Projects:         every public project
//   • Agents:           every active agent profile
//   • Blog posts:       every published post (per locale)
//
// We emit one URL per locale (`/es/...`, `/en/...`) and let Google
// pick the right one via hreflang in metadata.

import type { MetadataRoute } from "next"
import { createClient } from "@/lib/supabase/server"
import { routing } from "@/i18n/routing"

export const revalidate = 3600  // refresh once an hour

const STATIC_PATHS = [
  { path: "",            priority: 1.0, changefreq: "daily"   as const },
  { path: "/marketplace", priority: 0.9, changefreq: "hourly" as const },
  { path: "/agents",      priority: 0.7, changefreq: "weekly" as const },
  { path: "/contacto",    priority: 0.7, changefreq: "monthly" as const },
  { path: "/blog",        priority: 0.8, changefreq: "daily" as const },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://easyrent.cr").replace(/\/+$/, "")
  const supabase = await createClient()

  // ── Static
  const entries: MetadataRoute.Sitemap = []
  for (const locale of routing.locales) {
    for (const { path, priority, changefreq } of STATIC_PATHS) {
      entries.push({
        url:        `${baseUrl}/${locale}${path}`,
        changeFrequency: changefreq,
        priority,
      })
    }
  }

  // ── Properties (public marketplace)
  const { data: properties } = await supabase
    .from("v_marketplace")
    .select("slug, created_at")
    .order("created_at", { ascending: false })
    .limit(2000)

  for (const p of properties ?? []) {
    if (!p.slug) continue
    for (const locale of routing.locales) {
      entries.push({
        url:             `${baseUrl}/${locale}/p/${p.slug}`,
        lastModified:    p.created_at ?? undefined,
        changeFrequency: "weekly",
        priority:        0.7,
      })
    }
  }

  // ── Projects (public) — master templates only, agent-created
  // projects never enter the sitemap.
  const { data: projects } = await supabase
    .from("projects")
    .select("slug, updated_at")
    .eq("is_master_template", true)
    .eq("is_public", true)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })

  for (const p of projects ?? []) {
    if (!p.slug) continue
    for (const locale of routing.locales) {
      entries.push({
        url:             `${baseUrl}/${locale}/projects/${p.slug}`,
        lastModified:    p.updated_at ?? undefined,
        changeFrequency: "weekly",
        priority:        0.7,
      })
    }
  }

  // ── Agents (active, public profiles)
  const { data: agents } = await supabase
    .from("profiles")
    .select("slug, updated_at")
    .eq("status", "active")
    .is("deleted_at", null)
    .in("role", ["agent", "owner_admin"])
    .order("updated_at", { ascending: false })

  for (const a of agents ?? []) {
    if (!a.slug) continue
    for (const locale of routing.locales) {
      entries.push({
        url:             `${baseUrl}/${locale}/agents/${a.slug}`,
        lastModified:    a.updated_at ?? undefined,
        changeFrequency: "monthly",
        priority:        0.5,
      })
    }
  }

  // ── Blog posts (published, per locale — one entry per row)
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("slug, locale, published_at, updated_at")
    .eq("status", "published")
    .is("deleted_at", null)
    .order("published_at", { ascending: false })
    .limit(1000)

  for (const p of posts ?? []) {
    if (!p.slug) continue
    entries.push({
      url:             `${baseUrl}/${p.locale}/blog/${p.slug}`,
      lastModified:    p.updated_at ?? p.published_at ?? undefined,
      changeFrequency: "monthly",
      priority:        0.6,
    })
  }

  return entries
}
