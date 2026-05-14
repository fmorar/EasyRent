import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { formatListingPrice } from "@/lib/utils"
import { BedIcon, BathIcon } from "@/lib/property-icons"
import { AmenitiesList } from "@/components/shared/amenities-list"
import { HtmlDescription } from "@/components/shared/html-description"
import { LightboxProvider } from "@/components/ui/lightbox"
import { PropertyGallery } from "@/components/property/property-gallery"
import { PropertyVideos } from "@/components/property/property-videos"
import { Badge } from "@/components/ui/badge"
import { TourForm } from "@/components/property/tour-form"
import { MobileContactSticky } from "@/components/layout/mobile-contact-sticky"
import { PropertyContactSidebar } from "@/components/property/property-contact-sidebar"
import { LegalDisclaimer } from "@/components/shared/legal-disclaimer"
import { PropertyViewTracker } from "@/components/analytics/property-view-tracker"
import { ClickOnceTracker } from "@/components/analytics/click-once-tracker"
import { PublicShareButton } from "@/components/sharing/public-share-button"
import { PropertyLocationMap } from "@/components/property/property-location-map-loader"
import { MarketplaceCard } from "@/components/property/marketplace-card"
import { getSimilarProperties } from "@/lib/similar-properties"
import { MapPinIcon as MapPin, ArrowsPointingOutIcon as Maximize2, TruckIcon as Car } from "@heroicons/react/24/outline"
import { buildPropertyJsonLd, buildBreadcrumbJsonLd, jsonLdScript } from "@/lib/seo/json-ld"
import type { Metadata } from "next"
import type { MarketplaceProperty, Profile } from "@/types"
import type { VideoRow } from "@/lib/actions/media.actions"

interface Props {
  params:       Promise<{ slug: string }>
  searchParams: Promise<{ via?: string }>
}


export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug }  = await params
  const supabase  = await createClient()
  const locale    = await getLocale()

  const { data } = await supabase
    .from("v_marketplace")
    .select("id, title, description, listing_type, property_type, price, currency, bedrooms, area_sqm, display_address")
    .eq("slug", slug)
    .single() as {
      data: Pick<
        MarketplaceProperty,
        "id" | "title" | "description" | "listing_type" | "property_type" |
        "price" | "currency" | "bedrooms" | "area_sqm" | "display_address"
      > | null
    }

  if (!data) return {}

  // Strip HTML from the description for safe meta usage and trim to ~160 chars
  const stripHtml = (html: string | null) =>
    (html ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
  const truncate = (s: string, max = 160) =>
    s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…"

  // Build a descriptive SEO title following the skill's formula:
  //   "[Type] en [venta/alquiler] en [zona] · [N] hab · [precio]"
  const TYPE_ES: Record<string, string> = {
    apartment:  "Apartamento",
    house:      "Casa",
    land:       "Terreno",
    commercial: "Local comercial",
    office:     "Oficina",
    warehouse:  "Bodega",
  }
  const typeLabel = data.property_type ? TYPE_ES[data.property_type] ?? "Propiedad" : "Propiedad"
  const opLabel   = data.listing_type === "rent" ? "en alquiler" : "en venta"
  const lastZone  = data.display_address?.split(",").map((s) => s.trim()).filter(Boolean).slice(-2)[0]
  const priceStr  = data.price != null
    ? `${data.currency ?? "USD"} ${Number(data.price).toLocaleString("en-US")}${data.listing_type === "rent" ? "/mes" : ""}`
    : ""
  const titleParts = [
    `${typeLabel} ${opLabel}${lastZone ? ` en ${lastZone}` : ""}`,
    data.bedrooms != null ? `${data.bedrooms} hab` : null,
    data.area_sqm != null ? `${data.area_sqm} m²` : null,
    priceStr || null,
  ].filter(Boolean)
  const fallbackTitle = titleParts.join(" · ")

  // Description: use the stripped property description, or build one from facts
  const stripped = truncate(stripHtml(data.description))
  const fallbackDesc = stripped ||
    truncate(`${typeLabel} ${opLabel}${lastZone ? ` en ${lastZone}` : ""}` +
             `${data.bedrooms != null ? ` · ${data.bedrooms} hab` : ""}` +
             `${data.area_sqm != null ? ` · ${data.area_sqm} m²` : ""}` +
             `${priceStr ? ` · ${priceStr}` : ""}` +
             `. Consultá disponibilidad y agendá visita.`)

  // Translated SEO fields override when available
  if (locale !== "es" && data.id) {
    const { data: tr } = await supabase
      .from("property_translations")
      .select("seo_title, seo_description")
      .eq("property_id", data.id)
      .eq("locale", locale)
      // needs_review = human touched it; still want to show it (it's
      // strictly better than the original EN fallback). Only `pending`
      // (no content yet) stays out.
      .in("status", ["auto_translated", "needs_review", "reviewed"])
      .single() as { data: { seo_title: string | null; seo_description: string | null } | null }

    if (tr) {
      return buildMetadata({
        locale,
        slug,
        title:       tr.seo_title       ?? fallbackTitle,
        description: tr.seo_description ?? fallbackDesc,
      })
    }
  }

  return buildMetadata({ locale, slug, title: fallbackTitle, description: fallbackDesc })
}

// Shared OG/Twitter wiring for the property page. The `og:image`
// itself is supplied by the colocated `opengraph-image.tsx` route —
// Next.js auto-attaches the generated PNG to <head>, so we only need
// to set the canonical URL, locale, and copy here.
function buildMetadata(args: {
  locale:      string
  slug:        string
  title:       string
  description: string
}): Metadata {
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
    ?? "https://www.easyrent.house"
  )
  const canonical = `${baseUrl}/${args.locale}/p/${args.slug}`
  return {
    title:       args.title,
    description: args.description,
    alternates: {
      canonical,
      // hreflang — tells Google which language version to serve per
      // user. Without these, Google guesses and frequently sends CR
      // users to the EN page (duplicate-content penalty + worse CTR).
      // `x-default` is the fallback for visitors whose locale isn't
      // explicitly mapped (e.g. fr-FR, pt-BR) — we default to ES.
      languages: {
        es:          `${baseUrl}/es/p/${args.slug}`,
        en:          `${baseUrl}/en/p/${args.slug}`,
        "x-default": `${baseUrl}/es/p/${args.slug}`,
      },
    },
    openGraph: {
      type:        "website",
      title:       args.title,
      description: args.description,
      url:         canonical,
      siteName:    "easyrent",
      locale:      args.locale === "en" ? "en_US" : "es_CR",
    },
    twitter: {
      card:        "summary_large_image",
      title:       args.title,
      description: args.description,
    },
  }
}

export default async function PublicPropertyPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { via }  = await searchParams
  const supabase  = await createClient()
  const locale    = await getLocale()

  const { data: property } = await supabase
    .from("v_marketplace")
    .select("*")
    .eq("slug", slug)
    .single() as { data: MarketplaceProperty | null }

  if (!property) notFound()

  // Fetch additional fields not in the view
  const { data: propExtra } = await supabase
    .from("properties")
    .select("parking_spaces, floor, created_by, amenities, location_mode")
    .eq("id", property.id!)
    .single() as { data: { parking_spaces: number | null; floor: number | null; created_by: string; amenities: string[] | null; location_mode: "exact" | "approximate" | null } | null }

  // Fetch photos
  const { data: photos } = await supabase
    .from("property_photos")
    .select("url, caption, is_cover, order_index")
    .eq("property_id", property.id!)
    .order("order_index") as { data: { url: string; caption: string | null; is_cover: boolean; order_index: number }[] | null }

  // Fetch videos. RLS allows public SELECT on property_videos so this
  // works for unauthenticated visitors. Cast through a local generic
  // because the generated types don't know this table yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyClient = supabase as unknown as { from: (t: string) => any }
  const { data: videos } = await anyClient
    .from("property_videos")
    .select("id, property_id, youtube_url, title, order_index, created_at")
    .eq("property_id", property.id!)
    .order("order_index") as { data: VideoRow[] | null }

  // Fetch project amenities + photos when the property belongs to a project
  const [{ data: projectAmenities }, { data: projectPhotos }] = property.project_id
    ? await Promise.all([
        supabase
          .from("project_amenities")
          .select("name, icon")
          .eq("project_id", property.project_id)
          .order("sort_order"),
        supabase
          .from("project_photos")
          .select("url, caption, is_cover, order_index")
          .eq("project_id", property.project_id)
          .order("order_index") as unknown as Promise<{ data: { url: string; caption: string | null; is_cover: boolean; order_index: number }[] | null }>,
      ])
    : [{ data: null }, { data: null }]

  // Combine project + property amenities for display (project first, dedup)
  const amenitiesSeen = new Set<string>()
  const amenities: { name: string; icon: string | null }[] = []
  for (const a of (projectAmenities ?? []) as { name: string; icon: string | null }[]) {
    const k = a.name.toLowerCase()
    if (!amenitiesSeen.has(k)) { amenitiesSeen.add(k); amenities.push(a) }
  }
  for (const name of (propExtra?.amenities ?? [])) {
    const k = name.toLowerCase()
    if (!amenitiesSeen.has(k)) { amenitiesSeen.add(k); amenities.push({ name, icon: null }) }
  }

  // Contact resolution:
  //   1. `?via=<agent-slug>` (set by agent-profile cards on shared
  //      properties) — if the agent has an approved property_share
  //      on this property, they are the contact. The visitor came
  //      from their profile and they're the one working the lead.
  //   2. Otherwise — super_admin (platform owner). This page is
  //      gated on v_marketplace, which only exposes
  //      is_marketplace_visible=true rows, so any uncontextualised
  //      visit is a marketplace lead and routes through the platform.
  //   3. Fallbacks (creator → owner_admin) cover the edge where
  //      neither resolves so the page never goes contact-less.
  type ContactProfile = Pick<
    Profile,
    "id" | "full_name" | "slug" | "avatar_url" | "phone" | "email" | "role" | "bio"
  >

  let contactAgent: ContactProfile | null = null
  // Tracks the resolved via-agent's id so we can propagate ?via= to
  // similar-property cards where the same agent has access. Stays
  // null when via is missing, invalid, or doesn't validate.
  let viaAgentId: string | null = null

  // Step 1: ?via override — accepted when the agent is either the
  // creator OR has an approved share on this property. The page is
  // typically reached from /agents/<slug>, where clicks on any of
  // that agent's listings (their own + shared-with-them) should
  // route the lead to them. Anything else (guessed slug, stale
  // share) falls back to the marketplace default.
  if (via && property.id) {
    const { data: viaAgent } = await supabase
      .from("profiles")
      .select("id, full_name, slug, avatar_url, phone, email, role, bio")
      .eq("slug", via)
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle() as { data: ContactProfile | null }

    if (viaAgent) {
      const isCreator = propExtra?.created_by === viaAgent.id

      let hasApprovedShare = false
      if (!isCreator) {
        const { data: share } = await supabase
          .from("property_shares")
          .select("id")
          .eq("property_id", property.id)
          .eq("shared_with", viaAgent.id)
          .eq("status", "approved")
          .is("deleted_at", null)
          .limit(1)
          .maybeSingle<{ id: string }>()
        hasApprovedShare = !!share
      }

      if (isCreator || hasApprovedShare) {
        contactAgent = viaAgent
        viaAgentId = viaAgent.id
      }
    }
  }

  // Step 2: super_admin (marketplace channel).
  if (!contactAgent) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, slug, avatar_url, phone, email, role, bio")
      .eq("role", "super_admin")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle() as { data: ContactProfile | null }
    contactAgent = data
  }

  if (!contactAgent && propExtra?.created_by) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, slug, avatar_url, phone, email, role, bio")
      .eq("id", propExtra.created_by)
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle() as { data: ContactProfile | null }
    contactAgent = data
  }

  if (!contactAgent) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, slug, avatar_url, phone, email, role, bio")
      .eq("role", "owner_admin")
      .eq("status", "active")
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle() as { data: ContactProfile | null }
    contactAgent = data
  }
  // Keep `admin` as the variable name used downstream by the JSX —
  // smaller diff and the prop is the same shape.
  const admin = contactAgent

  // Fetch translation for current locale (only for non-default locales)
  const { data: translation } = locale !== "es"
    ? await supabase
        .from("property_translations")
        .select("title, description, public_address, seo_title, seo_description, status")
        .eq("property_id", property.id!)
        .eq("locale", locale)
        // needs_review = human touched it; still want to show it (it's
      // strictly better than the original EN fallback). Only `pending`
      // (no content yet) stays out.
      .in("status", ["auto_translated", "needs_review", "reviewed"])
        .single()
    : { data: null }

  // Resolved display values: translation → original fallback
  const displayTitle   = (translation as { title?: string | null } | null)?.title   ?? property.title
  const displayDesc    = (translation as { description?: string | null } | null)?.description ?? property.description
  const displayAddress = (translation as { public_address?: string | null } | null)?.public_address ?? property.display_address

  const t          = await getTranslations("properties")
  const tPublic    = await getTranslations("publicProperty")
  const tListing   = await getTranslations("properties.listingTypes")

  // Closed listings (sold / reserved) still reach this page — they
  // sit in v_marketplace because is_marketplace_visible was on when
  // the agent flipped the status. We swap most of the listing for a
  // "ya no está disponible" message + a strong push toward similar
  // properties. Off-market never gets here (v_marketplace filters it).
  const lt       = property.listing_type ?? "sale"
  const isClosed = property.status === "sold" || property.status === "reserved"
  const closedLabel = property.status === "reserved"
    ? t("publicStatuses.reserved")
    : t(lt === "rent" ? "publicStatuses.rented" : "publicStatuses.sold")

  // Merge property + project photos. Property photos first (interior of the
  // unit usually leads), then project photos (façade, amenities) appended.
  // Cover photo is hoisted to position 0 so the gallery's hero tile shows it.
  const merged = [
    ...(photos        ?? []),
    ...(projectPhotos ?? []),
  ]
  const coverIdx     = merged.findIndex((p) => p.is_cover)
  const mergedPhotos = coverIdx > 0
    ? [merged[coverIdx], ...merged.slice(0, coverIdx), ...merged.slice(coverIdx + 1)]
    : merged

  const parking = propExtra?.parking_spaces ?? null
  const floor   = property.floor ?? propExtra?.floor ?? null

  // Similar listings — keeps visitors moving when this one isn't
  // quite right. Tier-based scoring (intent + type + zone + price +
  // bedrooms). Returns at most 6, plus their cover photos.
  const { properties: similar, coverByProperty: similarCovers } = await getSimilarProperties({
    id:              property.id ?? "",
    listing_type:    property.listing_type,
    property_type:   property.property_type,
    price:           property.price == null ? null : Number(property.price),
    currency:        property.currency,
    bedrooms:        property.bedrooms,
    display_address: property.display_address,
  })

  // When the visitor arrived with a valid ?via=<agent>, propagate
  // that via to any similar-property card the agent ALSO has access
  // to (their own listings + listings shared with them). Cards
  // outside the agent's scope link to the plain marketplace URL,
  // which routes those leads to super_admin as usual.
  const similarIdsViaAgent = new Set<string>()
  if (viaAgentId && similar.length > 0) {
    const ids = similar.map((p) => p.id).filter((id): id is string => !!id)
    if (ids.length > 0) {
      const [ownRes, shareRes] = await Promise.all([
        supabase
          .from("properties")
          .select("id")
          .in("id", ids)
          .eq("created_by", viaAgentId)
          .is("deleted_at", null),
        supabase
          .from("property_shares")
          .select("property_id")
          .in("property_id", ids)
          .eq("shared_with", viaAgentId)
          .eq("status", "approved")
          .is("deleted_at", null),
      ])
      for (const row of ownRes.data ?? []) similarIdsViaAgent.add(row.id)
      for (const row of shareRes.data ?? []) similarIdsViaAgent.add(row.property_id)
    }
  }

  // Prefilled WhatsApp message — gives the agent immediate context
  // for inbound inquiries (which property, which channel) so they
  // can route the conversation without having to ask first. Built
  // from absolute URL so the link survives outside the app.
  const appUrl       = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.easyrent.house").replace(/\/$/, "")
  const listingPath  = via
    ? `/${locale}/p/${property.slug}?via=${encodeURIComponent(via)}`
    : `/${locale}/p/${property.slug}`
  const listingUrl   = `${appUrl}${listingPath}`
  const whatsappMessage = [
    `Hola, vi esta propiedad en easyrent y me interesa obtener información:`,
    ``,
    displayTitle,
    listingUrl,
  ].join("\n")

  // Schema.org JSON-LD — gives Google enough structured info to render
  // a richer SERP entry (price, photo, m², availability) and feeds the
  // listing into the knowledge graph. Always canonical (no ?via=).
  const canonicalUrl = `${appUrl}/${locale}/p/${property.slug}`
  const jsonLd = buildPropertyJsonLd({
    property: {
      id:              property.id,
      title:           displayTitle,
      description:     displayDesc ?? property.description ?? null,
      listing_type:    property.listing_type,
      property_type:   property.property_type,
      status:          property.status,
      price:           property.price,
      currency:        property.currency,
      bedrooms:        property.bedrooms,
      bathrooms:       property.bathrooms,
      area_sqm:        property.area_sqm,
      display_address: property.display_address,
      display_lat:     property.display_lat,
      display_lng:     property.display_lng,
      created_at:      property.created_at,
    },
    imageUrls:    (photos ?? []).map((p) => p.url),
    canonicalUrl,
    locale,
  })
  const breadcrumbs = buildBreadcrumbJsonLd([
    { name: locale === "en" ? "Home"        : "Inicio",       url: `${appUrl}/${locale}` },
    { name: locale === "en" ? "Marketplace" : "Marketplace",  url: `${appUrl}/${locale}/marketplace` },
    { name: displayTitle ?? "Propiedad", url: canonicalUrl },
  ])

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-(--spacing-section) md:py-(--spacing-major) space-y-(--spacing-section)">

      {/* Schema.org Apartment/House/LocalBusiness JSON-LD. Lets Google
          surface price, photos, m², and availability on the SERP card
          and feeds the listing into structured-data Search experiments. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbs) }}
      />

      {/* Fires property_viewed + deep_engagement after a short delay */}
      <PropertyViewTracker propertyId={property.id ?? ""} variant="branded" />

      {/* Closed-listing hero — bold, above-the-fold message so the
          visitor knows immediately the property is no longer
          available, with a fast jump to similar listings below. */}
      {isClosed && (
        <section className="rounded-2xl border bg-muted/40 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {closedLabel}
            </p>
            <h2 className="text-xl sm:text-2xl font-heading font-semibold leading-tight">
              {tPublic("closedHeadline")}
            </h2>
            <p className="text-sm text-muted-foreground max-w-prose">
              {tPublic("closedDesc")}
            </p>
          </div>
          {similar.length > 0 && (
            <a
              href="#similar-properties"
              className="inline-flex items-center justify-center rounded-lg bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:bg-foreground/90 transition-colors shrink-0"
            >
              {tPublic("closedCta")}
            </a>
          )}
        </section>
      )}

      {/* ── Photo gallery ─────────────────────────────────── */}
      <LightboxProvider
        photos={mergedPhotos.map((p) => ({ url: p.url, caption: p.caption }))}
      >
        <ClickOnceTracker
          propertyId={property.id ?? ""}
          eventType="gallery_opened"
          source="branded"
        >
          <div className="relative">
            <PropertyGallery
              photos={mergedPhotos}
              alt={displayTitle ?? ""}
              heroViewTransitionName={property.slug ? `cover-${property.slug}` : undefined}
            />
            {property.is_featured && (
              <Badge className="absolute top-3 left-3 z-10">{t("featured")}</Badge>
            )}
          </div>
        </ClickOnceTracker>
      </LightboxProvider>

      {/* ── Body — 2-col split (left content, right sticky contact) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-(--spacing-section) lg:gap-12 items-start">

        {/* ── LEFT — listing content ────────────────────────── */}
        <div className="min-w-0 space-y-(--spacing-section)">

          {/* Title row */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-(--spacing-cluster)">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Headline state = listing type + availability. A
                    rent+sold listing must read "Alquilado", not "En
                    alquiler"; same for sale+sold ("Vendido"),
                    reserved, and off_market. Color also tones down
                    when the listing is no longer available so the
                    visitor doesn't think the listing is open. */}
                {(() => {
                  const lt     = property.listing_type ?? "sale"
                  const status = property.status ?? "available"

                  let label: string
                  if (status === "sold")       label = t(lt === "rent" ? "publicStatuses.rented" : "publicStatuses.sold")
                  else if (status === "reserved")   label = t("publicStatuses.reserved")
                  else if (status === "off_market") label = t("publicStatuses.off_market")
                  else                              label = tListing(lt)

                  const available = status === "available"
                  const className = available
                    ? (lt === "rent"
                        ? "bg-info text-info-foreground text-[11px] uppercase tracking-wider"
                        : "bg-foreground text-background text-[11px] uppercase tracking-wider")
                    : "bg-muted text-muted-foreground text-[11px] uppercase tracking-wider"

                  return <Badge className={className}>{label}</Badge>
                })()}
                {property.listing_type === "rent" && property.is_furnished && property.status === "available" && (
                  <Badge className="bg-primary text-primary-foreground text-[11px] uppercase tracking-wider">
                    {t("furnished") /* fallback to filterBar key if missing */}
                  </Badge>
                )}
                <Badge variant="secondary">
                  {t(`types.${property.property_type}` as Parameters<typeof t>[0])}
                </Badge>
              </div>
              <h1
                className="font-heading font-semibold leading-[1.08] tracking-tight"
                style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)" }}
              >
                {displayTitle}
              </h1>
              {displayAddress && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                  <span className="flex items-center gap-1 min-w-0">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{displayAddress}</span>
                  </span>
                </div>
              )}
            </div>
            <div className="shrink-0 flex flex-col items-end gap-2">
              <p className="text-3xl font-heading font-bold text-foreground font-numeric leading-none">
                {formatListingPrice(property.price!, property.currency, property.listing_type)}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground align-baseline">
                  {property.currency}
                </span>
              </p>
              <LegalDisclaimer variant="price" className="text-right" />
              <PublicShareButton
                path={`/p/${property.slug ?? ""}`}
                title={displayTitle ?? ""}
                className="mt-1"
              />
            </div>
          </div>

          {/* Quick specs row — inline icon strip */}
          <div className="flex flex-wrap gap-x-6 gap-y-(--spacing-tight) py-(--spacing-cluster) border-y">
            {property.bedrooms != null && (
              <SpecChip
                icon={<BedIcon className="h-4 w-4" />}
                label={`${property.bedrooms} ${property.bedrooms !== 1 ? t("bedsPlural") : t("beds")}`}
              />
            )}
            {property.bathrooms != null && (
              <SpecChip
                icon={<BathIcon className="h-4 w-4" />}
                label={`${property.bathrooms} ${property.bathrooms !== 1 ? t("bathsPlural") : t("baths")}`}
              />
            )}
            {property.area_sqm != null && (
              <SpecChip
                icon={<Maximize2 className="h-4 w-4" />}
                label={`${property.area_sqm} m²`}
              />
            )}
            {parking != null && (
              <SpecChip
                icon={<Car className="h-4 w-4" />}
                label={`${parking} ${t("parkingCount")}`}
              />
            )}
          </div>

          {/* Detalles adicionales — 2-col label/value grid (no card shell — already inside page) */}
          <section className="space-y-(--spacing-cluster)">
            <h2 className="text-lg font-heading font-semibold">{t("areasAndLot")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
              <DetailRow
                label={t("tableStatus")}
                value={(() => {
                  // Same rent+sold → "Alquilado" mapping as the
                  // headline badge so the detail table doesn't
                  // contradict the pill above it.
                  const lt = property.listing_type ?? "sale"
                  if (property.status === "sold" && lt === "rent") return t("publicStatuses.rented")
                  return t(`publicStatuses.${property.status}` as Parameters<typeof t>[0]) ?? property.status!
                })()}
              />
              {displayAddress && (
                <DetailRow label={t("tableLocation")} value={displayAddress} />
              )}
              {property.area_sqm != null && (
                <DetailRow label={t("tableLivingSpace")} value={`${property.area_sqm.toLocaleString()} m²`} />
              )}
              {floor != null && (
                <DetailRow label={t("tableFloor")} value={`${floor}`} />
              )}
              {parking != null && (
                <DetailRow label={t("tableParking")} value={`${parking}`} />
              )}
              <DetailRow
                label={t("tablePropertyId")}
                value={property.id?.slice(0, 8).toUpperCase() ?? "—"}
              />
            </div>
          </section>

          {/* Amenidades — shared component, same on /projects/[slug] */}
          <AmenitiesList amenities={amenities} heading={t("amenities")} locale={locale} />

          {/* Ubicación + map */}
          {/* Map — hidden on closed listings (no actionable next step) */}
          {!isClosed && property.display_lat != null && property.display_lng != null && (
            <section className="space-y-(--spacing-cluster)">
              <h2 className="text-lg font-heading font-semibold">{t("tableLocation")}</h2>
              <ClickOnceTracker
                propertyId={property.id ?? ""}
                eventType="map_opened"
                source="branded"
              >
                <PropertyLocationMap
                  lat={Number(property.display_lat)}
                  lng={Number(property.display_lng)}
                  locationMode={propExtra?.location_mode ?? "approximate"}
                  address={displayAddress}
                />
              </ClickOnceTracker>
              {propExtra?.location_mode === "approximate" && (
                <LegalDisclaimer variant="approximate-location" tone="note" />
              )}
            </section>
          )}

          {/* Sale-only disclaimers (closing costs + documentation) */}
          {property.listing_type === "sale" && (
            <div className="space-y-(--spacing-tight)">
              <LegalDisclaimer variant="closing-costs" tone="note" />
              <LegalDisclaimer variant="documentation" tone="note" />
            </div>
          )}

          {/* Videos — YouTube embeds, ordered by order_index */}
          <PropertyVideos videos={videos ?? []} heading={t("videos")} />

          {/* Descripción — shared component */}
          <HtmlDescription html={displayDesc} heading={t("description")} />

          {/* Publicado por — inline editorial row, no nested card wrapper. */}
          {admin && (
            <section className="space-y-(--spacing-block) pt-(--spacing-block) border-t">
              <h2 className="text-lg font-heading font-semibold">{tPublic("publishedBy")}</h2>
              <Link
                href={`/agents/${admin.slug}`}
                className="group flex items-center gap-(--spacing-block) hover:[&_p:first-of-type]:underline underline-offset-4 decoration-foreground/30"
              >
                {admin.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={admin.avatar_url}
                    alt={admin.full_name}
                    className="h-14 w-14 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-primary/15 text-foreground flex items-center justify-center font-heading font-semibold text-base shrink-0">
                    {admin.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-base font-heading font-semibold truncate">
                    {admin.full_name}
                  </p>
                  {admin.bio && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{admin.bio}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0 group-hover:text-foreground transition-colors">
                  {tPublic("viewProfile")}
                </span>
              </Link>
            </section>
          )}
        </div>

        {/* ── RIGHT — sticky contact sidebar (desktop only).
                Hidden on closed listings — there's nothing to
                schedule a visit for, and we already push the
                visitor toward similar properties via the hero
                banner above. */}
        {admin && !isClosed && (
          <PropertyContactSidebar
            propertyId={property.id ?? ""}
            agent={admin}
            trackingSource="branded"
            whatsappMessage={whatsappMessage}
            form={
              <TourForm
                propertyId={property.id!}
                propertyName={property.title!}
                propertySlug={property.slug!}
                capturedBy={propExtra?.created_by ?? null}
                listingType={property.listing_type ?? null}
              />
            }
          />
        )}
      </div>

      {/* ── Similar properties ───────────────────────────────────
              Same intent (sale/rent) and ideally same type + zone.
              Spans the full page width so it gets visual breathing
              room beneath the 2-col body. Hidden when there's nothing
              to recommend. */}
      {similar.length > 0 && (
        <section id="similar-properties" className="space-y-(--spacing-block) pt-(--spacing-section) border-t scroll-mt-20">
          <header className="space-y-(--spacing-tight)">
            <h2
              className="font-heading font-bold tracking-tight leading-[1.05]"
              style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)" }}
            >
              {isClosed ? tPublic("similarHeadlineClosed") : tPublic("similarHeadline")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {tPublic("similarSubtitle")}
            </p>
          </header>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-(--spacing-block) sm:gap-(--spacing-section)">
            {similar.map((p) => (
              <MarketplaceCard
                key={p.id}
                property={p}
                coverUrl={p.id ? similarCovers[p.id] : undefined}
                viaAgentSlug={p.id && similarIdsViaAgent.has(p.id) ? via : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Mobile sticky bottom bar (replaces sidebar on <lg) — same
              rule as the desktop sidebar: hidden when the listing is
              closed. */}
      {admin && !isClosed && (
        <MobileContactSticky
          phone={admin.phone}
          email={admin.email}
          ctaLabel={t("scheduleTour")}
          modalTitle={t("scheduleTour")}
          modalDescription={t("scheduleTourDesc")}
          whatsappMessage={whatsappMessage}
        >
          <TourForm
            propertyId={property.id!}
            propertyName={property.title!}
            propertySlug={property.slug!}
            capturedBy={propExtra?.created_by ?? null}
            listingType={property.listing_type ?? null}
          />
        </MobileContactSticky>
      )}
    </div>
  )
}

function SpecChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-medium font-numeric">{label}</span>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline gap-3 py-2 text-sm border-b border-dashed last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right truncate">{value}</span>
    </div>
  )
}
