// Public landing page (`/`).
//
// Marketing-focused: hero with search → trust signals → featured
// properties → agents → CTA → FAQ. The actual full-power search
// lives at `/marketplace`; this page funnels visitors INTO that.
//
// Data dependencies (all server-side, RLS-friendly):
//   • locations          → distinct cantons from `properties` for the hero dropdown
//   • latest properties  → 6 most recent marketplace-visible rows
//   • cover photos       → one per property (is_cover desc, order_index asc)
//   • hero photo         → reuses the first property's cover as a placeholder until the user uploads a dedicated hero image
//   • agents             → up to 6 active agents/owner_admins for the showcase
//
// Order matters: the hero is BIG so the user sees the primary CTA
// (search) above the fold; everything else is scroll-revealed.

import { createClient } from "@/lib/supabase/server"
import { HeroSearch, type HeroProject } from "@/components/landing/hero-search"
import { TrustSignals } from "@/components/landing/trust-signals"
import { FeaturedProperties } from "@/components/landing/featured-properties"
import { FeaturedProjects, type FeaturedProjectCard } from "@/components/landing/featured-projects"
import { AgentsShowcase, type AgentCard } from "@/components/landing/agents-showcase"
import { GoogleReviewsEditorial } from "@/components/project/google-reviews-editorial"
import { SAMPLE_REVIEWS_AGGREGATE } from "@/lib/sample-reviews"
import { MarketplaceFaq } from "@/components/marketplace/marketplace-faq"
import { PublicFooter } from "@/components/layout/public-footer"
import { getLocale } from "next-intl/server"
import { buildHreflangAlternates } from "@/lib/seo/json-ld"
import type { Metadata } from "next"
import type { MarketplaceProperty } from "@/types"

const FEATURED_LIMIT = 6
const PROJECTS_LIMIT = 6
const AGENTS_LIMIT   = 6

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  ?? "https://www.easyrent.house"
)

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const title  = locale === "en"
    ? "easyrent · Real estate in Costa Rica · Apartments, houses, projects"
    : "easyrent · Inmuebles en Costa Rica · Apartamentos, casas, proyectos"
  const description = locale === "en"
    ? "Browse apartments and houses for rent and sale in Costa Rica. Verified listings, vetted agents, transparent pricing."
    : "Encontrá apartamentos y casas en alquiler y venta en Costa Rica. Listados verificados, agentes seleccionados, precios transparentes."

  return {
    title,
    description,
    alternates: buildHreflangAlternates({
      path:    "/",
      locale,
      baseUrl: SITE_URL,
    }),
    openGraph: {
      type:        "website",
      title,
      description,
      url:         `${SITE_URL}/${locale}`,
      siteName:    "easyrent",
      locale:      locale === "en" ? "en_US" : "es_CR",
    },
    twitter: {
      card:        "summary_large_image",
      title,
      description,
    },
  }
}

export default async function LandingPage() {
  const supabase = await createClient()

  // ── Locations for the hero search dropdown ─────────────────────
  // Pull distinct second-to-last segment of `display_address`
  // (canton, in CR addresses like "Cond X, San Rafael, Escazú,
  // San José, 10906, Costa Rica"). Cheap LIKE-based fallback when
  // we can't trust structure.
  const { data: locRows } = await supabase
    .from("properties")
    .select("display_address")
    .eq("is_marketplace_visible", true)
    .is("deleted_at", null)
    .limit(200)
  const locations = Array.from(new Set(
    (locRows ?? [])
      .map((r) => {
        const parts = (r.display_address ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s && !/^\d{4,6}$/.test(s) && !/costa\s+rica/i.test(s))
        // Pick the canton-ish segment when we have at least 3 segments.
        if (parts.length >= 3) return parts[parts.length - 2]
        return parts[0] ?? ""
      })
      .filter(Boolean),
  )).sort()

  // ── Latest 6 marketplace-visible properties + their covers ────
  const { data: properties } = await supabase
    .from("v_marketplace")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(FEATURED_LIMIT)
  const featured = (properties ?? []) as MarketplaceProperty[]

  const propertyIds = featured.map((p) => p.id).filter((v): v is string => !!v)
  const coverByProperty:  Record<string, string | undefined> = {}
  // Group the full sorted photo list per property so the featured-
  // properties section's mobile cards can render a swipe carousel
  // from the same fetched data.
  const photosByProperty: Record<string, Array<{ url: string; caption?: string | null }>> = {}
  if (propertyIds.length > 0) {
    const { data: photos } = await supabase
      .from("property_photos")
      .select("property_id, url, caption, is_cover, order_index")
      .in("property_id", propertyIds)
      .order("is_cover", { ascending: false })
      .order("order_index", { ascending: true })
    for (const ph of photos ?? []) {
      // First photo per property wins (since we sorted is_cover desc).
      if (!coverByProperty[ph.property_id]) {
        coverByProperty[ph.property_id] = ph.url
      }
      const arr = photosByProperty[ph.property_id] ?? []
      arr.push({ url: ph.url, caption: ph.caption })
      photosByProperty[ph.property_id] = arr
    }
  }

  // ── Latest public projects + their photos ─────────────────────
  // Public + active + not deleted, newest first. We pull ALL photos
  // per project (sorted by is_cover desc, then order_index) so we
  // can derive both the carousel covers (first photo) and the hero
  // mini-card thumbnail strip (next 3 photos) from a single batched
  // lookup.
  // Only master-template projects surface on public marketing pages.
  // Agent-created / forked projects live on their owner's dashboard
  // but never the platform marketing site — that's reserved for the
  // editorialised catalog.
  const { data: projectRows } = await supabase
    .from("projects")
    .select("id, slug, title, description, developer_name, location_label, total_units, available_units")
    .eq("is_master_template", true)
    .eq("is_public", true)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(PROJECTS_LIMIT)

  const projectIds = (projectRows ?? []).map((p) => p.id).filter((v): v is string => !!v)
  const photosByProject: Record<string, string[]> = {}
  if (projectIds.length > 0) {
    const { data: projectPhotos } = await supabase
      .from("project_photos")
      .select("project_id, url, is_cover, order_index")
      .in("project_id", projectIds)
      .order("is_cover", { ascending: false })
      .order("order_index", { ascending: true })
    for (const ph of projectPhotos ?? []) {
      (photosByProject[ph.project_id] ??= []).push(ph.url)
    }
  }

  const projects: FeaturedProjectCard[] = (projectRows ?? []).map((p) => ({
    id:              p.id,
    slug:            p.slug,
    title:           p.title,
    description:     p.description,
    developer_name:  p.developer_name,
    location_label:  p.location_label,
    total_units:     p.total_units,
    available_units: p.available_units,
    cover_url:       photosByProject[p.id]?.[0] ?? null,
  }))

  // Hero anchor: the most recent public PROJECT (not a property — per
  // the brand rule, projects render larger / more architectural and
  // are better hero subjects). Shape includes cover + 3 thumbs for
  // the floating mini-card strip.
  const heroProjectRow = projectRows?.[0] ?? null
  const heroProject: HeroProject | null = heroProjectRow ? {
    id:              heroProjectRow.id,
    slug:            heroProjectRow.slug,
    title:           heroProjectRow.title,
    description:     heroProjectRow.description,
    developer_name:  heroProjectRow.developer_name,
    location_label:  heroProjectRow.location_label,
    total_units:     heroProjectRow.total_units,
    available_units: heroProjectRow.available_units,
    cover_url:       photosByProject[heroProjectRow.id]?.[0] ?? null,
    thumb_urls:      photosByProject[heroProjectRow.id]?.slice(1, 4) ?? [],
  } : null

  // ── Agents (active, with avatars preferred) ────────────────────
  const { data: agentRows } = await supabase
    .from("profiles")
    .select("id, full_name, slug, avatar_url, bio, role")
    .in("role", ["agent", "owner_admin"])
    .eq("status", "active")
    .is("deleted_at", null)
    .order("full_name", { ascending: true })
    .limit(AGENTS_LIMIT)
  const agents: AgentCard[] = (agentRows ?? []).map((a) => ({
    id:         a.id,
    full_name:  a.full_name,
    slug:       a.slug,
    avatar_url: a.avatar_url,
    bio:        a.bio,
    // super_admin and owner_admin both surface as "Agencia" on the
    // public listing — the agent vs agency distinction is the only
    // thing the public cares about, the super tier is internal.
    role_label: a.role === "owner_admin" || a.role === "super_admin" ? "Agencia" : "Agente",
  }))

  return (
    <main className="bg-background">
      <HeroSearch
        locations={locations}
        project={heroProject}
      />

      {/* ── Trust band — sits on canvas. Reuses heroProject for the
              tilted preview card so we don't double-fetch. */}
      <TrustSignals
        featuredProject={heroProject ? {
          slug:           heroProject.slug,
          title:          heroProject.title,
          cover_url:      heroProject.cover_url,
          location_label: heroProject.location_label,
          total_units:    heroProject.total_units,
        } : null}
      />

      {/* ── Editorial unified surface ──────────────────────────────
              All sections sit on the same warm cream background so the
              landing reads as ONE cohesive piece (Horizon Estate
              style) instead of alternating tinted/canvas bands. The
              rhythm now comes from card placement, asymmetric grids,
              and typography — not from background swaps. */}
      <FeaturedProperties
        properties={featured}
        coverByProperty={coverByProperty}
        photosByProperty={photosByProperty}
      />

      <FeaturedProjects projects={projects} />

      <AgentsShowcase agents={agents} />

      {/* ── Reviews — same `<GoogleReviewsEditorial>` the project
              page uses. Until the agency wires its own Google place
              ID we render curated CR-voseo samples from
              `lib/sample-reviews.ts`; replace with a live
              `fetchGoogleReviews(...)` call once the place id is
              configured. */}
      <GoogleReviewsEditorial
        reviews={SAMPLE_REVIEWS_AGGREGATE.reviews}
        rating={SAMPLE_REVIEWS_AGGREGATE.rating}
        totalCount={SAMPLE_REVIEWS_AGGREGATE.user_ratings_total}
      />

      <MarketplaceFaq />

      {/* Public footer — newsletter + link columns + giant wordmark.
              Pass the hero project's cover so the wordmark knock-out
              shows the architectural photo through the letterforms. */}
      <PublicFooter wordmarkPhotoUrl={heroProject?.cover_url ?? null} />
    </main>
  )
}
