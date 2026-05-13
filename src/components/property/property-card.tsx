// Internal dashboard card — built on top of the shared ListingCardShell so it
// matches the public MarketplaceCard visually. Adds badges + share button as
// photo overlays + a status/type meta row in the body.
"use client"

import { Badge } from "@/components/ui/badge"
import { useTranslations } from "next-intl"
import { formatListingPrice } from "@/lib/utils"
import {
  PROPERTY_TYPE_LABELS,
  formatListingState,
} from "@/lib/labels"
import { ListingCardShell } from "@/components/shared/listing-card"
import { PropertySpecs } from "@/components/shared/property-specs"
import { GlobeAltIcon as Globe, EyeIcon as Eye, PencilSquareIcon } from "@heroicons/react/24/outline"
import { PropertyCardActions } from "@/components/property/property-card-actions"
import type { Property } from "@/types"

interface PropertyWithPhotos extends Property {
  property_photos?: { url: string; is_cover: boolean; order_index: number }[]
}

interface PropertyCardProps {
  property:      PropertyWithPhotos
  currentUserId: string
  isAdmin?:      boolean
  /** Full name of the agent who uploaded the property. Used to label
   *  the "Compartida por …" badge on cards a non-owner is seeing. */
  creatorName?:  string | null
}

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  available:  "default",
  reserved:   "secondary",
  sold:       "destructive",
  off_market: "outline",
}

export function PropertyCard({ property, currentUserId, isAdmin, creatorName }: PropertyCardProps) {
  const t         = useTranslations("card")
  const isOwner   = property.created_by === currentUserId
  const canShare  = isOwner || Boolean(isAdmin)
  // Draft detection: the "new property" flow creates a row with a slug
  // prefixed `draft-`. Until the agent renames it (which only happens
  // when they save real content), the property is considered a draft.
  // We surface that state with a yellow pill + a dashed ring on the
  // card so blank intakes stand out from real listings in the grid.
  const isDraft = property.slug?.startsWith("draft-") ?? false
  const coverPhoto = property.property_photos?.find((p) => p.is_cover)
    ?? property.property_photos?.sort((a, b) => a.order_index - b.order_index)[0]

  return (
    <ListingCardShell
      href={`/properties/${property.id}`}
      coverUrl={coverPhoto?.url ?? null}
      coverAlt={property.title}
      className={isDraft ? "outline-2 outline-dashed outline-warning/50 outline-offset-2 rounded-xl" : undefined}
      photoOverlay={
        <>
          {/* Visibility badges (top-left). Drafts get their own pill
              that takes precedence — public / unbranded badges don't
              apply to a draft (we keep them off the marketplace until
              there's real content). */}
          <div className="absolute top-2 left-2 flex gap-1 z-10">
            {isDraft ? (
              <Badge className="text-xs gap-1 bg-warning text-warning-foreground">
                <PencilSquareIcon className="h-2.5 w-2.5" />
                {t("draftBadge")}
              </Badge>
            ) : (
              <>
                {property.is_marketplace_visible && (
                  <Badge className="text-xs gap-1 bg-primary text-primary-foreground">
                    <Globe className="h-2.5 w-2.5" />
                    {t("publicBadge")}
                  </Badge>
                )}
                {property.anonymous_slug && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Eye className="h-2.5 w-2.5" />
                    {t("anonBadge")}
                  </Badge>
                )}
              </>
            )}
          </div>

          {/* Actions menu is always rendered so every agent — owner,
              admin, or shared-with — can download photos and copy the
              social-post text. The menu just hides Share / Edit /
              Delete for non-owners via `canManage`.
              Non-owners ALSO get a "shared with you" pill so the
              relationship is visible at a glance. */}
          <div
            className="absolute top-2 right-2 z-20 flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {!canShare && (
              <Badge variant="outline" className="text-xs bg-white/90">
                {creatorName
                  ? t("sharedBy", { name: creatorName })
                  : t("sharedWithYou")}
              </Badge>
            )}
            <PropertyCardActions
              propertyId={property.id}
              propertyTitle={property.title}
              propertySlug={property.slug}
              isMarketplaceVisible={property.is_marketplace_visible}
              initialAnonymousSlug={property.anonymous_slug}
              canManage={canShare}
            />
          </div>
        </>
      }
    >
      {/* Listing intent + type meta. For drafts we hide the
          listing-state pill (it would misleadingly say "Disponible"
          on a blank intake) and show a "Sin completar" hint instead. */}
      <div className="flex items-center justify-between gap-2">
        {isDraft ? (
          <Badge variant="outline" className="text-xs text-warning border-warning/40">
            {t("draftIncomplete")}
          </Badge>
        ) : (
          <Badge variant={STATUS_COLORS[property.status]} className="text-xs">
            {formatListingState(property.listing_type ?? "sale", property.status)}
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">
          {PROPERTY_TYPE_LABELS[property.property_type]}
        </span>
      </div>

      {/* Title + price */}
      <div className="flex items-baseline justify-between gap-3 min-w-0">
        <h3 className="min-w-0 flex-1 text-base font-heading font-semibold leading-tight truncate">
          {property.title}
        </h3>
        <span className="text-base font-numeric font-semibold shrink-0">
          {formatListingPrice(property.price, property.currency, property.listing_type)}
        </span>
      </div>

      <PropertySpecs
        bedrooms={property.bedrooms}
        bathrooms={property.bathrooms}
        area_sqm={property.area_sqm}
        className="pt-2"
      />
    </ListingCardShell>
  )
}
