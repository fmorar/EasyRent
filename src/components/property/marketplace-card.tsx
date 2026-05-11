"use client"

import { Badge } from "@/components/ui/badge"
import { useTranslations } from "next-intl"
import { formatListingPrice } from "@/lib/utils"
import { ListingCardShell } from "@/components/shared/listing-card"
import { PropertySpecs } from "@/components/shared/property-specs"
import type { MarketplaceProperty } from "@/types"

interface Props {
  property:  MarketplaceProperty
  coverUrl?: string
}

/**
 * Public marketplace card — uses ListingCardShell for canonical visual.
 * Body shows: title + price · address · specs.
 */
export function MarketplaceCard({ property, coverUrl }: Props) {
  const t           = useTranslations("properties.listingTypes")
  const tAmenity    = useTranslations("marketplace.filterBar")
  const listingType = property.listing_type ?? "sale"

  return (
    <ListingCardShell
      href={`/p/${property.slug}`}
      coverUrl={coverUrl ?? null}
      coverAlt={property.title ?? ""}
      // Shared name pairs with the hero photo on `/p/[slug]`. The
      // browser morphs THIS image into the destination hero on
      // navigation. Slug guarantees uniqueness in the marketplace
      // grid (1 slug = 1 card). CSS for the morph lives in globals.
      viewTransitionName={property.slug ? `cover-${property.slug}` : undefined}
      photoOverlay={
        <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-1">
          <Badge
            className={
              "text-[10px] uppercase tracking-wider " +
              (listingType === "rent"
                ? "bg-info text-info-foreground"
                : "bg-foreground text-background")
            }
          >
            {t(listingType)}
          </Badge>
          {listingType === "rent" && property.is_furnished && (
            <Badge className="text-[10px] uppercase tracking-wider bg-primary text-primary-foreground">
              {tAmenity("amueblado")}
            </Badge>
          )}
        </div>
      }
    >
      <div className="flex items-baseline justify-between gap-3 min-w-0">
        <h3 className="min-w-0 flex-1 text-base font-heading font-semibold leading-tight truncate">
          {property.title}
        </h3>
        <span className="text-base font-numeric font-semibold shrink-0">
          {property.price != null && property.currency
            ? formatListingPrice(property.price, property.currency, listingType)
            : ""}
        </span>
      </div>

      {property.display_address && (
        <p className="text-xs text-muted-foreground truncate min-w-0">
          {property.display_address}
        </p>
      )}

      <PropertySpecs
        bedrooms={property.bedrooms}
        bathrooms={property.bathrooms}
        area_sqm={property.area_sqm}
        className="pt-2"
      />
    </ListingCardShell>
  )
}
