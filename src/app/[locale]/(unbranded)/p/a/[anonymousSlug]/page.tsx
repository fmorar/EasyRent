// Anonymous (unbranded) property link.
//
// Renders the SAME property content as `/p/[slug]` but without:
//   • The public-site top nav / marketplace links / sign-in
//   • Any agent name, photo, phone, email, or contact form
//   • The "Compartir" share button
//
// Data path: `v_properties_anonymous` (SECURITY DEFINER view that strips
// all identity fields). The raw `properties` table is REVOKED from anon —
// this view is the only access path for unauthenticated visitors.

import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { formatListingPrice } from "@/lib/utils"
import { getAmenityIcon } from "@/lib/amenity-icons"
import { translateAmenity } from "@/lib/amenity-translations"
import { BedIcon, BathIcon } from "@/lib/property-icons"
import { LightboxProvider } from "@/components/ui/lightbox"
import { PropertyGallery } from "@/components/property/property-gallery"
import { PropertyVideos } from "@/components/property/property-videos"
import { Badge } from "@/components/ui/badge"
import {
  MapPinIcon as MapPin,
  ArrowsPointingOutIcon as Maximize2,
  TruckIcon as Car,
} from "@heroicons/react/24/outline"
import { PropertyLocationMap } from "@/components/property/property-location-map-loader"
import { LegalDisclaimer } from "@/components/shared/legal-disclaimer"
import { PropertyViewTracker } from "@/components/analytics/property-view-tracker"
import type { Metadata } from "next"
import type { AnonymousProperty } from "@/types"
import type { VideoRow } from "@/lib/actions/media.actions"

interface Props {
  params: Promise<{ anonymousSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { anonymousSlug } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .from("v_properties_anonymous")
    .select("title")
    .eq("anonymous_slug", anonymousSlug)
    .single()

  // Generic title — don't reveal property identity in meta
  return {
    title:   data ? "Detalles de la propiedad" : "No encontrada",
    robots:  { index: false, follow: false },
  }
}

export default async function AnonymousPropertyPage({ params }: Props) {
  const { anonymousSlug } = await params
  const supabase = await createClient()
  const locale   = await getLocale()

  const { data: property } = await supabase
    .from("v_properties_anonymous")
    .select("*")
    .eq("anonymous_slug", anonymousSlug)
    .single() as { data: AnonymousProperty | null }

  if (!property) notFound()

  // Photos are safe to show (no identity data on photo rows)
  const { data: photos } = await supabase
    .from("property_photos")
    .select("url, caption, is_cover, order_index")
    .eq("property_id", property.id!)
    .order("order_index") as {
      data: { url: string; caption: string | null; is_cover: boolean; order_index: number }[] | null
    }

  // Videos — YouTube embeds carry no identity, safe to surface here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyClient = supabase as unknown as { from: (t: string) => any }
  const { data: videos } = await anyClient
    .from("property_videos")
    .select("id, property_id, youtube_url, title, order_index, created_at")
    .eq("property_id", property.id!)
    .order("order_index") as { data: VideoRow[] | null }

  // Project amenities + project photos (when linked)
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
          .order("order_index") as unknown as Promise<{
            data: { url: string; caption: string | null; is_cover: boolean; order_index: number }[] | null
          }>,
      ])
    : [{ data: null }, { data: null }]

  // Merge project amenities (with icons) + property amenities (string
  // names) and dedup by lower-cased name. Project first so its icons
  // win when both list the same amenity. Amenities are non-identifying
  // (piscina, gimnasio, BBQ, etc.) so they're safe on the anonymous
  // surface — see migration 20260512160000.
  const projAmenities = (projectAmenities ?? []) as { name: string; icon: string | null }[]
  const propAmenities = ((property as { amenities?: string[] | null }).amenities ?? [])
    .map((name) => ({ name, icon: null }))
  const seen      = new Set<string>()
  const amenities: { name: string; icon: string | null }[] = []
  for (const a of [...projAmenities, ...propAmenities]) {
    const k = a.name.toLowerCase()
    if (!seen.has(k)) { seen.add(k); amenities.push(a) }
  }

  // Translation overlay (non-default locale)
  // needs_review = human-touched draft; still strictly better than
  // falling back to the original ES text. Only `pending` (empty) is
  // excluded.
  const { data: translation } = locale !== "es"
    ? await supabase
        .from("property_translations")
        .select("title, description, public_address, status")
        .eq("property_id", property.id!)
        .eq("locale", locale)
        .in("status", ["auto_translated", "needs_review", "reviewed"])
        .single()
    : { data: null }

  const displayTitle   = (translation as { title?: string | null } | null)?.title          ?? property.title
  const displayDesc    = (translation as { description?: string | null } | null)?.description ?? property.description
  const displayAddress = (translation as { public_address?: string | null } | null)?.public_address ?? property.display_address

  const t        = await getTranslations("properties")
  const tListing = await getTranslations("properties.listingTypes")

  // Merge property + project photos (interior leads, façade follows).
  // Cover photo hoisted to position 0 so the gallery's hero shows it.
  const merged = [
    ...(photos        ?? []),
    ...(projectPhotos ?? []),
  ]
  const coverIdx     = merged.findIndex((p) => p.is_cover)
  const mergedPhotos = coverIdx > 0
    ? [merged[coverIdx], ...merged.slice(0, coverIdx), ...merged.slice(coverIdx + 1)]
    : merged

  const parking = property.parking_spaces ?? null
  const floor   = property.floor ?? null

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-(--spacing-section) space-y-(--spacing-section)">

      {/* Fires property_viewed + anonymous_link_viewed + deep_engagement */}
      <PropertyViewTracker propertyId={property.id ?? ""} variant="anonymous" />

      {/* ── Photo gallery ─────────────────────────────────── */}
      <LightboxProvider
        photos={mergedPhotos.map((p) => ({ url: p.url, caption: p.caption }))}
      >
        <PropertyGallery photos={mergedPhotos} alt={displayTitle ?? ""} />
      </LightboxProvider>

      {/* ── Body — single column (no contact sidebar by design) ── */}
      <div className="max-w-3xl space-y-(--spacing-section)">

        {/* Title row — chips, title, address cluster tight (space-y-1)
            then price anchored to its own column. The disclaimer beneath
            the price uses spacing-tight so it reads as a footnote, not
            a separate block. */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-(--spacing-cluster)">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                className={
                  property.listing_type === "rent"
                    ? "bg-info text-info-foreground text-[11px] uppercase tracking-wider"
                    : "bg-foreground text-background text-[11px] uppercase tracking-wider"
                }
              >
                {tListing(property.listing_type ?? "sale")}
              </Badge>
              {property.listing_type === "rent" && property.is_furnished && (
                <Badge className="bg-primary text-primary-foreground text-[11px] uppercase tracking-wider">
                  {t("furnished")}
                </Badge>
              )}
              <Badge variant="secondary">
                {t(`types.${property.property_type}` as Parameters<typeof t>[0])}
              </Badge>
            </div>
            <h1 className="text-3xl font-heading font-semibold leading-tight">
              {displayTitle}
            </h1>
            {displayAddress && (
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{displayAddress}</span>
                {property.location_mode === "approximate" && (
                  <span className="ml-1 text-xs italic opacity-70 shrink-0">
                    ({t("approximateArea")})
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right space-y-(--spacing-tight)">
            <p className="text-3xl font-heading font-bold text-foreground font-numeric leading-none">
              {formatListingPrice(property.price!, property.currency, property.listing_type)}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground align-baseline">
                {property.currency}
              </span>
            </p>
            <LegalDisclaimer variant="price" />
          </div>
        </div>

        {/* Quick specs row */}
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
        <section className="space-y-(--spacing-block)">
          <h2 className="text-lg font-heading font-semibold tracking-tight">{t("areasAndLot")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
            <DetailRow
              label={t("tableStatus")}
              value={t(`publicStatuses.${property.status}` as Parameters<typeof t>[0]) ?? property.status!}
            />
            {displayAddress && (
              <DetailRow label={t("tableLocation")} value={displayAddress} />
            )}
            {property.area_sqm != null && (
              <DetailRow
                label={t("tableLivingSpace")}
                value={`${property.area_sqm.toLocaleString()} m²`}
              />
            )}
            {floor != null && (
              <DetailRow label={t("tableFloor")} value={`${floor}`} />
            )}
            {parking != null && (
              <DetailRow label={t("tableParking")} value={`${parking}`} />
            )}
          </div>
        </section>

        {/* Amenidades */}
        {amenities.length > 0 && (
          <section className="space-y-(--spacing-block)">
            <h2 className="text-lg font-heading font-semibold tracking-tight">{t("amenities")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-(--spacing-tight)">
              {amenities.map((a) => (
                <div key={a.name} className="flex items-center gap-2 text-sm py-1.5 border-b border-dashed last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0">
                  <span className="text-foreground shrink-0">
                    {getAmenityIcon(a.name, "h-4 w-4")}
                  </span>
                  <span>{translateAmenity(a.name, locale)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Ubicación + map */}
        {property.display_lat != null && property.display_lng != null && (
          <section className="space-y-(--spacing-block)">
            <h2 className="text-lg font-heading font-semibold tracking-tight">{t("tableLocation")}</h2>
            <PropertyLocationMap
              lat={Number(property.display_lat)}
              lng={Number(property.display_lng)}
              locationMode={property.location_mode ?? "approximate"}
              address={displayAddress}
            />
            {property.location_mode === "approximate" && (
              <LegalDisclaimer variant="approximate-location" tone="note" />
            )}
          </section>
        )}

        {/* Sale-only closing-costs disclaimer */}
        {property.listing_type === "sale" && (
          <LegalDisclaimer variant="closing-costs" tone="note" />
        )}

        {/* Videos — YouTube embeds, identity-free, ordered by order_index */}
        <PropertyVideos videos={videos ?? []} heading={t("videos")} />

        {/* Descripción */}
        {displayDesc && (
          <section className="space-y-(--spacing-block)">
            <h2 className="text-lg font-heading font-semibold tracking-tight">{t("description")}</h2>
            <div
              className="preview-prose text-sm text-muted-foreground leading-relaxed max-w-prose"
              dangerouslySetInnerHTML={{ __html: displayDesc }}
            />
          </section>
        )}

        {/* Footer note — no branding */}
        <footer className="border-t pt-(--spacing-block) text-center">
          <p className="text-xs text-muted-foreground">
            {t("anonymousFooter")}
          </p>
        </footer>
      </div>
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
