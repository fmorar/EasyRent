import type { MarketplaceProperty, PropertyType } from "@/types"

/**
 * Schema.org JSON-LD builders.
 *
 * Why inline JSON-LD instead of microdata: Google + Bing + DuckDuckGo
 * all recommend `<script type="application/ld+json">` because it
 * separates structured data from presentational markup. It also lets
 * us colocate the schema with the page that owns it (no Tailwind/JSX
 * gymnastics to thread `itemprop` everywhere) and ship a single JSON
 * blob the crawler parses cleanly.
 *
 * All builders return plain objects so callers can stringify them and
 * drop them into a <script>. We never include nullish fields — Google
 * treats `null`/`undefined` as "value present but invalid", which
 * tanks the structured-data score in Search Console.
 */

// Property type → Schema.org @type mapping. Apartment/House are the
// granular types Google recommends for residential listings.
// Commercial uses LocalBusiness (more specific than "Place") because
// it carries `address` + `geo` + `priceRange` semantics out of the box.
const SCHEMA_TYPE_BY_PROPERTY: Record<PropertyType, string> = {
  apartment:  "Apartment",
  house:      "House",
  land:       "Place",          // no dedicated Schema.org type for raw land
  commercial: "LocalBusiness",
  office:     "LocalBusiness",
  warehouse:  "Place",
}

interface PropertySchemaInput {
  property: Pick<
    MarketplaceProperty,
    | "id" | "title" | "description" | "listing_type" | "property_type"
    | "status" | "price" | "currency" | "bedrooms" | "bathrooms"
    | "area_sqm" | "display_address" | "display_lat" | "display_lng"
    | "created_at"
  >
  /** Absolute photo URLs ordered as they appear on the page (cover first). */
  imageUrls:    string[]
  /** Absolute canonical URL of the listing page. */
  canonicalUrl: string
  /** Page locale — used for the inLanguage field. */
  locale:       string
}

/**
 * Builds an Apartment / House / LocalBusiness schema with embedded
 * Offer. Schema.org's `Apartment` extends `Place` → `Accommodation`,
 * so all the residential-specific fields (numberOfRooms,
 * numberOfBathroomsTotal, floorSize) live on the type itself.
 *
 * `businessFunction` differentiates rent (`LeaseOut`) from sale
 * (`Sell`), which is the field Google uses to distinguish the two on
 * the SERP listing card.
 *
 * `availability` is conservative — we only mark a listing `InStock`
 * when its status is "available". Anything else (sold/reserved/off
 * market) ships as `OutOfStock` so the SERP card never advertises
 * something the visitor can't actually buy or rent.
 */
export function buildPropertyJsonLd(input: PropertySchemaInput) {
  const { property, imageUrls, canonicalUrl, locale } = input
  const propertyType = property.property_type ?? "apartment"
  const schemaType   = SCHEMA_TYPE_BY_PROPERTY[propertyType] ?? "Place"

  const isRent = property.listing_type === "rent"

  // ── Offer ──
  const availability = property.status === "available"
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock"

  const offer: Record<string, unknown> = {
    "@type":          "Offer",
    url:              canonicalUrl,
    availability,
    businessFunction: isRent
      ? "https://schema.org/LeaseOut"
      : "https://schema.org/Sell",
  }
  if (property.price != null) {
    offer.price         = Number(property.price)
    offer.priceCurrency = property.currency ?? "USD"
  }
  if (isRent && property.price != null) {
    // For rentals, expose unit & periodicity so Google understands
    // it's a monthly rate, not a one-shot price.
    offer.priceSpecification = {
      "@type":          "UnitPriceSpecification",
      price:            Number(property.price),
      priceCurrency:    property.currency ?? "USD",
      referenceQuantity: {
        "@type":   "QuantitativeValue",
        value:     1,
        unitCode:  "MON",       // UN/CEFACT code for "month"
      },
    }
  }

  // ── Address ──
  // We only have `display_address` (free-form), so we parse the last
  // two comma-separated segments as locality + region. CR is the only
  // country we list in today; if that ever changes, gate this.
  const addressParts = (property.display_address ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  const locality = addressParts[addressParts.length - 2] ?? null
  const region   = addressParts[addressParts.length - 1] ?? null

  const address: Record<string, unknown> = {
    "@type":         "PostalAddress",
    addressCountry:  "CR",
  }
  if (locality) address.addressLocality = locality
  if (region)   address.addressRegion   = region

  // ── Base schema ──
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type":    schemaType,
    name:       property.title,
    url:        canonicalUrl,
    address,
    offers:     offer,
    inLanguage: locale === "en" ? "en" : "es",
  }

  if (property.description) {
    // Strip HTML for the schema description — Google rejects schema
    // values that contain HTML tags.
    schema.description = property.description
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 5000)
  }

  if (imageUrls.length > 0) {
    schema.image = imageUrls
  }

  if (property.display_lat != null && property.display_lng != null) {
    schema.geo = {
      "@type":   "GeoCoordinates",
      latitude:  property.display_lat,
      longitude: property.display_lng,
    }
  }

  if (property.created_at) {
    schema.datePosted = property.created_at
  }

  // Residential-specific fields. Apartment/House inherit these from
  // Accommodation; LocalBusiness/Place don't, so we only emit them
  // when the schema type accepts them.
  if (schemaType === "Apartment" || schemaType === "House") {
    if (property.bedrooms != null)  schema.numberOfRooms            = property.bedrooms
    if (property.bathrooms != null) schema.numberOfBathroomsTotal   = property.bathrooms
    if (property.area_sqm  != null) schema.floorSize = {
      "@type":  "QuantitativeValue",
      value:    property.area_sqm,
      unitCode: "MTK",            // UN/CEFACT code for "square metre"
    }
  }

  return schema
}

/**
 * Site-wide Organization schema. Drops onto the root layout so every
 * page exposes brand identity (name, logo, social, geo coverage)
 * regardless of which route the crawler enters at.
 *
 * Uses `Organization` (with `additionalType: RealEstateAgent`) rather
 * than `RealEstateAgent` directly because Google's knowledge-panel
 * pipeline maps Organization → "Company" entity cards reliably,
 * whereas the more specific types get less SERP treatment.
 */
export function buildOrganizationJsonLd(baseUrl: string) {
  return {
    "@context":     "https://schema.org",
    "@type":        "Organization",
    additionalType: "https://schema.org/RealEstateAgent",
    name:           "easyrent",
    alternateName:  "easyrent.house",
    url:            baseUrl,
    logo:           `${baseUrl}/icon.svg`,
    description:    "Plataforma inmobiliaria de Costa Rica para comprar, alquilar y publicar propiedades.",
    areaServed: {
      "@type": "Country",
      name:    "Costa Rica",
    },
    sameAs: [
      "https://instagram.com/easyrent.house",
      "https://facebook.com/easyrent.house",
    ],
  }
}

/**
 * Convenience: returns a stringified `<script>`-ready payload. JSX
 * consumers should pass `dangerouslySetInnerHTML={{ __html: ... }}`
 * to avoid React escaping the JSON.
 */
export function jsonLdScript(schema: unknown): string {
  // Replace `</` to defeat any chance of a closing `</script>` in
  // user-controlled fields (description, title) breaking the script
  // block. Google's docs explicitly recommend this escape.
  return JSON.stringify(schema).replace(/</g, "\\u003c")
}
