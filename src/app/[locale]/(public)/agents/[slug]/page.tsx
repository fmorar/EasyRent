// Agent public profile — shows the agent's properties + shared-with-them properties.
// Contact shown on each property card = that agent's contact (not the original owner's).

import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MarketplaceCard } from "@/components/property/marketplace-card"
import { AgentContactBand } from "@/components/agent/agent-contact-band"
import { PublicFooter } from "@/components/layout/public-footer"
import { StatsStrip } from "@/components/shared/stats-strip"
import { EmptyState } from "@/components/shared/empty-state"
import {
  PhoneIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline"
import { StarIcon } from "@heroicons/react/24/solid"
import { getLocale } from "next-intl/server"
import {
  buildAgentJsonLd,
  buildBreadcrumbJsonLd,
  buildHreflangAlternates,
  jsonLdScript,
} from "@/lib/seo/json-ld"
import type { Metadata } from "next"
import type { Profile, MarketplaceProperty } from "@/types"

interface Props {
  params: Promise<{ slug: string }>
}

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  ?? "https://www.easyrent.house"
)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const locale   = await getLocale()
  const supabase = await createClient()

  const { data } = await supabase
    .from("profiles")
    .select("full_name, bio")
    .eq("slug", slug)
    .eq("status", "active")
    .single() as { data: Pick<Profile, "full_name" | "bio"> | null }

  if (!data) return {}

  // Title formula — name + role + locale-aware tail. The tail is
  // important: it differentiates the page from social profiles with
  // the same name and gives Google a hook for "Agente inmobiliario
  // Costa Rica" type queries.
  const title = locale === "en"
    ? `${data.full_name} · Real Estate Agent in Costa Rica · easyrent`
    : `${data.full_name} · Agente inmobiliario en Costa Rica · easyrent`

  // Description: prefer the agent's bio (stripped). Fall back to a
  // generated descriptor so we never ship empty meta.
  const stripHtml = (html: string) =>
    html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
  const fallbackDesc = locale === "en"
    ? `Browse the listings managed by ${data.full_name}. Consult availability, schedule viewings, and request property details.`
    : `Explorá las propiedades publicadas por ${data.full_name}. Consultá disponibilidad, agendá visitas y pedí información detallada.`
  const description = data.bio ? stripHtml(data.bio).slice(0, 160) : fallbackDesc

  return {
    title,
    description,
    alternates: buildHreflangAlternates({
      path:    `/agents/${slug}`,
      locale,
      baseUrl: SITE_URL,
    }),
    openGraph: {
      type:        "profile",
      title,
      description,
      siteName:    "easyrent",
      locale:      locale === "en" ? "en_US" : "es_CR",
      url:         `${SITE_URL}/${locale}/agents/${slug}`,
    },
    twitter: {
      card:        "summary_large_image",
      title,
      description,
    },
  }
}

export default async function AgentProfilePage({ params }: Props) {
  const { slug } = await params
  const supabase  = await createClient()

  const { data: agent } = await supabase
    .from("profiles")
    .select("id, full_name, slug, avatar_url, cover_url, bio, phone, email, role, invited_by, zones, created_at")
    .eq("slug", slug)
    .eq("status", "active")
    .is("deleted_at", null)
    .single() as { data: Pick<Profile, "id" | "full_name" | "slug" | "avatar_url" | "cover_url" | "bio" | "phone" | "email" | "role" | "invited_by" | "zones" | "created_at"> | null }

  if (!agent) notFound()

  const { data: inviter } = agent.invited_by
    ? await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", agent.invited_by)
        .maybeSingle() as { data: { full_name: string } | null }
    : { data: null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: properties } = await (supabase as any).rpc(
    "get_agent_profile_properties",
    { p_agent_id: agent.id },
  ) as { data: import("@/types").AgentProfileProperty[] | null }

  // Fetch full photo lists for the carousel inside each property
  // card on mobile. The RPC above only returns the `cover_url` —
  // here we batch one extra query keyed by property_id so each card
  // can swipe through up to N photos.
  const propIds = (properties ?? [])
    .map((p) => p.property_id)
    .filter((id): id is string => !!id)
  const photosByProperty: Record<string, Array<{ url: string; caption?: string | null }>> = {}
  if (propIds.length > 0) {
    const { data: phRows } = await supabase
      .from("property_photos")
      .select("property_id, url, caption, is_cover, order_index")
      .in("property_id", propIds)
      .order("is_cover", { ascending: false })
      .order("order_index", { ascending: true })
    for (const ph of phRows ?? []) {
      const arr = photosByProperty[ph.property_id] ?? []
      arr.push({ url: ph.url, caption: ph.caption })
      photosByProperty[ph.property_id] = arr
    }
  }

  const initials = agent.full_name
    .split(" ")
    .map((n: string) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const listingsCount = properties?.length ?? 0
  const roleLabel = agent.role === "owner_admin" || agent.role === "super_admin"
    ? "Agencia"
    : "Agente"

  // ── Editorial stats ──────────────────────────────────────────────
  // Real metrics come straight from the DB; the response-time cell
  // is aspirational but defensible (we publish that 24h commitment
  // on every form). Skips cells with zero data so the strip stays
  // strong instead of padded with placeholders.
  const yearsOnPlatform = agent.created_at
    ? Math.max(1, new Date().getFullYear() - new Date(agent.created_at).getFullYear() + 1)
    : 0
  const zonesCount = agent.zones?.length ?? 0
  const agentStats: Array<{ number: string; label: string }> = []
  if (listingsCount > 0) {
    agentStats.push({
      number: listingsCount.toLocaleString("es-CR"),
      label:  "PROPIEDADES\nPUBLICADAS",
    })
  }
  if (zonesCount > 0) {
    agentStats.push({
      number: zonesCount.toLocaleString("es-CR"),
      label:  "ZONAS\nQUE COBRE",
    })
  }
  if (yearsOnPlatform > 0) {
    agentStats.push({
      number: `+${yearsOnPlatform}`,
      label:  yearsOnPlatform === 1 ? "AÑO\nDE TRAYECTORIA" : "AÑOS\nDE TRAYECTORIA",
    })
  }
  agentStats.push({
    number: "<24h",
    label:  "TIEMPO\nDE RESPUESTA",
  })

  // Location summary for the contact band's "zonas" card.
  const zonesSummary = zonesCount > 0
    ? `${zonesCount} ${zonesCount === 1 ? "zona" : "zonas"} en el GAM`
    : null

  // ── SEO structured data ─────────────────────────────────────────
  // The agent page exposes two schemas: RealEstateAgent (so Google
  // recognizes the page as a business entity for local-pack queries)
  // and BreadcrumbList (so the SERP entry renders Home › Agentes ›
  // Agent name instead of a flat URL).
  const locale       = await getLocale()
  const profileUrl   = `${SITE_URL}/${locale}/agents/${agent.slug ?? slug}`
  const agentSchema  = buildAgentJsonLd({
    name:        agent.full_name,
    url:         profileUrl,
    imageUrl:    agent.avatar_url,
    description: agent.bio,
    phone:       agent.phone,
    zones:       Array.isArray(agent.zones) ? agent.zones : null,
  })
  const breadcrumbs  = buildBreadcrumbJsonLd([
    { name: locale === "en" ? "Home"   : "Inicio",  url: `${SITE_URL}/${locale}` },
    { name: locale === "en" ? "Agents" : "Agentes", url: `${SITE_URL}/${locale}/agents` },
    { name: agent.full_name, url: profileUrl },
  ])

  return (
    <div className="bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(agentSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbs) }}
      />

      {/* ─── HERO BANNER ────────────────────────────────────────
              Cover photo is full-bleed (edge to edge); the avatar
              overlap + meta row sit inside the constrained max-w-6xl
              column so they align with the rest of the page rail. */}
      <section>
        {/* Full-bleed cover photo — `cover_url` takes precedence; if
            empty, we fall back to a blurred avatar; if neither is
            set, render a neutral muted gradient. */}
        <div className="relative w-full h-48 sm:h-64 lg:h-80 overflow-hidden">
          {agent.cover_url ? (
            <Image
              src={agent.cover_url}
              alt=""
              aria-hidden
              fill
              preload
              fetchPriority="high"
              sizes="100vw"
              className="object-cover"
            />
          ) : agent.avatar_url ? (
            <>
              <Image
                src={agent.avatar_url}
                alt=""
                aria-hidden
                fill
                preload
                fetchPriority="high"
                sizes="100vw"
                className="object-cover scale-110 blur-xl opacity-50"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-muted/60 to-muted/40" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/60" />
          )}

          {/* Bottom fade — softens the cover → page-bg transition so
              the avatar + headline that overlap the boundary always
              sit on a clean cream backdrop, regardless of the photo's
              colour at the bottom edge. Tall enough to cover the
              avatar's overlap region (`-mt-12/16/20`) so the dark
              forest/sky/whatever in a busy photo never touches the
              ink text. */}
          <div
            className="absolute inset-x-0 bottom-0 h-24 sm:h-32 lg:h-40 bg-gradient-to-b from-transparent to-background pointer-events-none"
            aria-hidden
          />
        </div>

        {/* Constrained content — avatar overlap + meta + bio */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Overlapping info row */}
          <div className="-mt-12 sm:-mt-16 lg:-mt-20 flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 lg:gap-8 relative z-10">
          <Avatar className="h-24 w-24 sm:h-32 sm:w-32 lg:h-36 lg:w-36 border-4 border-background shadow-lg shrink-0">
            {/* thumbWidth=144 (lg rendered width) → Supabase serves a
                ~288px WebP instead of the 2000×2000 PNG original.
                Drops the avatar payload from ~400 KiB to ~15 KiB. */}
            <AvatarImage src={agent.avatar_url ?? undefined} alt={agent.full_name} thumbWidth={144} />
            <AvatarFallback className="text-2xl sm:text-3xl">{initials}</AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0 sm:pb-2 space-y-2">
            <div>
              <h1 className="text-2xl sm:text-3xl font-heading font-bold leading-tight tracking-tight">
                {agent.full_name}
              </h1>
              {inviter?.full_name && (
                <p className="text-sm text-muted-foreground mt-1">
                  de {inviter.full_name}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {/* Static rating placeholder until reviews land */}
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <StarIcon key={n} className="h-3.5 w-3.5 text-foreground fill-foreground" />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  (<span className="font-numeric">{listingsCount}</span> listings)
                </span>
              </div>

              {agent.phone && (
                <a
                  href={`tel:${agent.phone}`}
                  className="flex items-center gap-2 text-foreground/80 hover:text-foreground transition-colors"
                >
                  <PhoneIcon className="h-3.5 w-3.5" />
                  <span className="font-numeric">{agent.phone}</span>
                </a>
              )}

              <span className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full bg-muted border">
                {roleLabel}
              </span>
            </div>
          </div>

          {/* Hero CTAs — hidden on mobile (sticky bottom bar covers the same actions) */}
          <div className="hidden lg:flex flex-wrap gap-2 pb-3">
            <a
              href="#contact"
              className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full border bg-background hover:bg-muted transition-colors text-sm font-medium"
            >
              Mensaje
            </a>
            <a
              href="#contact"
              className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              Get In Touch
              <ArrowRightIcon className="h-4 w-4" />
            </a>
          </div>
        </div>

          {agent.bio && (
            // Bio: readable measure (~65ch) sits left-aligned under
            // the overlapping avatar/info row. Parent already
            // provides horizontal padding.
            <p className="mt-(--spacing-block) text-sm text-muted-foreground max-w-prose leading-relaxed">
              {agent.bio}
            </p>
          )}
        </div>
      </section>

      {/* ─── STATS — same `<StatsStrip>` shared with the landing's
              TrustSignals and the project page, fed with agent
              metrics so this surface speaks the same numeric
              language as the rest of the public site. */}
      {agentStats.length > 0 && (
        <section className="border-b">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-(--spacing-section) md:py-(--spacing-major)">
            <StatsStrip stats={agentStats} />
          </div>
        </section>
      )}

      {/* ─── LISTINGS — listing grid + two-tone editorial title ─── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-(--spacing-section) md:py-(--spacing-major)">
        <div className="space-y-(--spacing-section)">
          <div className="space-y-(--spacing-tight) max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Portafolio
            </p>
            <h2
              className="font-heading font-bold tracking-tight leading-[1.05] text-foreground"
              style={{ fontSize: "clamp(1.875rem, 4.5vw, 3.25rem)" }}
            >
              Propiedades de {agent.full_name.split(" ")[0]}{" "}
              <span className="text-foreground/40">
                ({listingsCount})
              </span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Listings publicados y compartidos por este asesor.
            </p>
          </div>

          {!properties?.length ? (
            <EmptyState message={`${agent.full_name.split(" ")[0]} aún no tiene propiedades publicadas. Volvé pronto a revisar.`} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-(--spacing-block) sm:gap-(--spacing-section)">
              {properties.map((property) => {
                const stub: MarketplaceProperty = {
                  id:              property.property_id,
                  slug:            property.slug,
                  title:           property.title,
                  description:     property.description,
                  price:           property.price,
                  currency:        property.currency,
                  property_type:   property.property_type,
                  listing_type:    property.listing_type,
                  is_furnished:    property.is_furnished,
                  status:          property.status,
                  bedrooms:        property.bedrooms,
                  bathrooms:       property.bathrooms,
                  area_sqm:        property.area_sqm,
                  floor:           property.floor,
                  is_featured:     false,
                  project_id:      null,
                  display_address: property.display_address,
                  display_lat:     property.display_lat,
                  display_lng:     property.display_lng,
                  created_at:      new Date().toISOString(),
                }
                return (
                  <MarketplaceCard
                    key={property.property_id}
                    property={stub}
                    coverUrl={property.cover_url ?? undefined}
                    photos={photosByProperty[property.property_id]}
                    // Always carry the agent's slug — clicks from an
                    // agent profile should route the lead to that
                    // agent, whether the property is their own or
                    // shared with them. The detail page validates the
                    // via slug against creator OR approved share, so
                    // a guessed slug can't hijack the contact.
                    viaAgentSlug={agent.slug}
                  />
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ─── CONTACT — editorial band, same vocabulary as the
              project page's contact section so both detail surfaces
              share one visual register. */}
      <AgentContactBand
        agentId={agent.id}
        agentName={agent.full_name}
        agentEmail={agent.email}
        agentPhone={agent.phone}
        locationLabel={zonesSummary}
      />

      {/* ─── FOOTER — same wordmark + newsletter as the landing.
              The wordmark backdrop reuses this agent's own cover so
              the bottom of the page echoes the top — falls back to
              the avatar (rendered as a soft blur via the footer
              component) when no cover is uploaded yet. */}
      <PublicFooter wordmarkPhotoUrl={agent.cover_url ?? agent.avatar_url ?? null} />
    </div>
  )
}

