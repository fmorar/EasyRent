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
 * Builds a `@graph` payload containing two linked nodes:
 *
 *   1. Apartment / House / LocalBusiness — the residential entity,
 *      carrying Accommodation-specific fields (numberOfRooms,
 *      numberOfBathroomsTotal, floorSize, address, geo).
 *
 *   2. Product — the commercial wrapper, carrying offers, images,
 *      description, and `itemOffered` linking back to the Apartment
 *      via `@id`.
 *
 * Why split: Schema.org's Apartment inherits from Place → Thing, NOT
 * Product, so properties like `offers`, `image`, `datePosted`, and
 * `inLanguage` aren't valid on it. Google's Rich Results validator
 * flags them as errors. The @graph pattern is the standard fix: each
 * node carries only properties valid for its type, and the two are
 * linked through `itemOffered`/`@id`. Crawlers reconstruct the
 * full entity from both.
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
  const listingId = `${canonicalUrl}#listing`
  const offerId   = `${canonicalUrl}#offer`

  // ── Address parsing ────────────────────────────────────────────
  // Costa Rica display_address typically looks like:
  //   "Calle X, San Rafael, Escazú, San José, 10906, Costa Rica"
  // We strip the trailing country + postal code, then read the last
  // two remaining segments as locality (canton) and region (province).
  const { locality, region, postalCode } = parseDisplayAddress(property.display_address)
  const address: Record<string, unknown> = {
    "@type":         "PostalAddress",
    addressCountry:  "CR",                  // ISO 3166-1 alpha-2
  }
  if (locality)   address.addressLocality = locality
  if (region)     address.addressRegion   = region
  if (postalCode) address.postalCode      = postalCode

  // ── Description (HTML-stripped, length-capped) ─────────────────
  const description = property.description
    ? property.description
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 5000)
    : undefined

  // ── Apartment/House node ───────────────────────────────────────
  const apartmentNode: Record<string, unknown> = {
    "@type":  schemaType,
    "@id":    listingId,
    name:     property.title,
    url:      canonicalUrl,
    address,
  }
  if (description) apartmentNode.description = description
  if (imageUrls.length > 0) apartmentNode.image = imageUrls
  if (property.display_lat != null && property.display_lng != null) {
    apartmentNode.geo = {
      "@type":   "GeoCoordinates",
      latitude:  property.display_lat,
      longitude: property.display_lng,
    }
  }
  // Residential-specific fields only land on types that inherit from
  // Accommodation. LocalBusiness/Place don't accept them.
  if (schemaType === "Apartment" || schemaType === "House") {
    if (property.bedrooms != null)  apartmentNode.numberOfRooms          = property.bedrooms
    if (property.bathrooms != null) apartmentNode.numberOfBathroomsTotal = property.bathrooms
    if (property.area_sqm  != null) apartmentNode.floorSize = {
      "@type":  "QuantitativeValue",
      value:    property.area_sqm,
      unitCode: "MTK",            // UN/CEFACT code for "square metre"
    }
  }

  // ── Product / Offer node ───────────────────────────────────────
  const availability = property.status === "available"
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock"

  const offer: Record<string, unknown> = {
    "@type":      "Offer",
    "@id":        offerId,
    url:          canonicalUrl,
    availability,
    itemOffered:  { "@id": listingId },
    // Note: we deliberately omit `businessFunction`. Schema.org
    // accepts it on Offer, but Google's Rich Results validator
    // currently rejects every value (its allowlist for this context
    // is empty — see Rich Results error "Valid values are: []").
    // Rent vs sale is already encoded for crawlers via:
    //   • `priceSpecification.referenceQuantity.unitCode = "MON"`
    //     (rentals only) → marks it as a monthly rate
    //   • `category` (e.g. "Apartamento en alquiler") → explicit
    //   • `name`/`description` → natural-language context
  }
  if (property.price != null) {
    offer.price         = Number(property.price)
    offer.priceCurrency = property.currency ?? "USD"
  }
  if (isRent && property.price != null) {
    // For rentals, expose unit & periodicity so Google understands
    // it's a monthly rate, not a one-shot price. The UnitPriceSpec
    // is the canonical way to say "$X per month".
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
  // validFrom — when the listing was posted. Offer accepts datePosted
  // semantically via validFrom (datePosted is reserved for JobPosting).
  if (property.created_at) offer.validFrom = property.created_at

  // Locale-aware product category, e.g. "Apartamento en alquiler" /
  // "Apartment for sale". This is what shows up as the product
  // category in SERP cards.
  const typeLabelEs = {
    Apartment:     "Apartamento",
    House:         "Casa",
    Place:         "Inmueble",
    LocalBusiness: "Local comercial",
  } as Record<string, string>
  const typeLabelEn = {
    Apartment:     "Apartment",
    House:         "House",
    Place:         "Real Estate",
    LocalBusiness: "Commercial Space",
  } as Record<string, string>
  const intentEs = isRent ? "en alquiler" : "en venta"
  const intentEn = isRent ? "for rent"    : "for sale"
  const productCategory = locale === "en"
    ? `${typeLabelEn[schemaType] ?? "Real Estate"} ${intentEn}`
    : `${typeLabelEs[schemaType] ?? "Inmueble"} ${intentEs}`

  const productNode: Record<string, unknown> = {
    "@type":  "Product",
    "@id":    `${canonicalUrl}#product`,
    name:     property.title,
    category: productCategory,
    url:      canonicalUrl,
    // brand silences Google's "no GTIN/brand identifier" warning.
    // Real estate listings don't have manufacturer brands, so we
    // use the platform brand as the legitimate identifier.
    brand: {
      "@type": "Brand",
      name:    "easyrent",
    },
    offers:   offer,
  }
  if (description) productNode.description = description
  if (imageUrls.length > 0) productNode.image = imageUrls

  return {
    "@context": "https://schema.org",
    "@graph": [apartmentNode, productNode],
  }

  // Note on remaining Product warnings: shippingDetails and
  // hasMerchantReturnPolicy are e-commerce-only fields that don't
  // apply to real estate (you don't ship or return an apartment).
  // We deliberately leave them out — populating them with synthetic
  // values would misrepresent the listing to crawlers.
}

/**
 * Parses a Costa Rica free-form `display_address` into structured
 * locality / region / postalCode components. Strips trailing country
 * tokens ("Costa Rica" / "CR") and numeric postal codes before
 * picking out the meaningful segments.
 *
 * Examples:
 *   "Cond X, San Rafael, Escazú, San José, 10906, Costa Rica"
 *     → { locality: "Escazú", region: "San José", postalCode: "10906" }
 *   "San Pedro, San José"
 *     → { locality: "San Pedro", region: "San José" }
 *   "Costa Rica"
 *     → { locality: null, region: null }
 */
function parseDisplayAddress(raw: string | null | undefined): {
  locality:   string | null
  region:     string | null
  postalCode: string | null
} {
  if (!raw) return { locality: null, region: null, postalCode: null }
  let parts = raw.split(",").map((s) => s.trim()).filter(Boolean)

  // Strip country at end (case-insensitive: "Costa Rica" / "CR").
  if (parts.length > 0 && /^(costa rica|cr)$/i.test(parts[parts.length - 1]!)) {
    parts = parts.slice(0, -1)
  }

  // Strip a postal code if it sits anywhere in the last two slots.
  let postalCode: string | null = null
  for (let i = parts.length - 1; i >= Math.max(0, parts.length - 2); i--) {
    if (/^\d{4,6}$/.test(parts[i]!)) {
      postalCode = parts[i]!
      parts = [...parts.slice(0, i), ...parts.slice(i + 1)]
      break
    }
  }

  // From the remaining segments, the last is province (region), the
  // one before that is canton (locality). Anything earlier is a more
  // granular street/neighbourhood we don't expose via schema.
  const region   = parts[parts.length - 1] ?? null
  const locality = parts.length >= 2 ? parts[parts.length - 2]! : null

  return { locality, region, postalCode }
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
 * FAQPage — Google renders these Q&As as an accordion DIRECTLY under
 * the page's SERP entry, dramatically expanding the listing's
 * vertical real estate and CTR. Each Question must have one Answer
 * with a non-empty answer text.
 *
 * Question text and acceptedAnswer.text both go through `stripHtml`
 * — Google validates FAQPage strictly and rejects HTML in either
 * field.
 */
export function buildFaqJsonLd(items: Array<{ question: string; answer: string }>) {
  const stripHtml = (s: string) =>
    s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
  const cleaned = items
    .map((i) => ({ q: stripHtml(i.question), a: stripHtml(i.answer) }))
    .filter((i) => i.q && i.a)
  if (cleaned.length === 0) return null
  return {
    "@context":  "https://schema.org",
    "@type":     "FAQPage",
    mainEntity:  cleaned.map((i) => ({
      "@type":          "Question",
      name:             i.q,
      acceptedAnswer:   {
        "@type": "Answer",
        text:    i.a,
      },
    })),
  }
}

/**
 * WebSite + SearchAction — unlocks the "sitelinks search box" inside
 * the Google SERP entry for brand queries like "easyrent". Visitors
 * can search the site without leaving the SERP first. The site
 * receives the query as `?q=<term>` on the marketplace route, which
 * already handles free-text search.
 *
 * Only emit this on a single canonical surface (root layout). If you
 * also emit it on sub-pages Google flags it as duplicate.
 */
export function buildWebSiteJsonLd(baseUrl: string) {
  const cleanBase = baseUrl.replace(/\/$/, "")
  return {
    "@context":       "https://schema.org",
    "@type":          "WebSite",
    name:             "easyrent",
    url:              cleanBase,
    inLanguage:       ["es-CR", "en"],
    potentialAction: {
      "@type":      "SearchAction",
      target:       {
        "@type":     "EntryPoint",
        urlTemplate: `${cleanBase}/es/marketplace?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  }
}

interface ProjectSchemaInput {
  /** Display title. */
  name:               string
  /** Canonical project URL. */
  url:                string
  /** Optional HTML description — gets stripped + capped. */
  description?:       string | null
  /** Absolute image URLs ordered as on the page. */
  imageUrls:          string[]
  /** Free-form address shown on the page (`project.display_address`). */
  displayAddress?:    string | null
  /** Display coordinates — public-safe approximate. */
  displayLat?:        number | null
  displayLng?:        number | null
  /** Total units in the project. */
  totalUnits?:        number | null
  /** ISO date when the project completes / completed. */
  completionDate?:    string | null
  /** Amenity names (project_amenities.name). */
  amenities?:         string[]
}

/**
 * ApartmentComplex schema for residential project pages. Inherits
 * from Accommodation → Residence → Place, so it accepts amenities,
 * address, geo, image, plus complex-specific
 * `numberOfAccommodationUnits`.
 *
 * Note we don't nest an Offer here — projects span multiple units
 * with their own prices, so the Offer-per-unit lives on each
 * property page instead.
 */
export function buildProjectJsonLd(input: ProjectSchemaInput) {
  const { locality, region, postalCode } = parseDisplayAddress(input.displayAddress)
  const address: Record<string, unknown> = {
    "@type":         "PostalAddress",
    addressCountry:  "CR",
  }
  if (locality)   address.addressLocality = locality
  if (region)     address.addressRegion   = region
  if (postalCode) address.postalCode      = postalCode

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type":    "ApartmentComplex",
    name:       input.name,
    url:        input.url,
    address,
  }
  if (input.description) {
    schema.description = input.description
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 5000)
  }
  if (input.imageUrls.length > 0) schema.image = input.imageUrls
  if (input.displayLat != null && input.displayLng != null) {
    schema.geo = {
      "@type":   "GeoCoordinates",
      latitude:  input.displayLat,
      longitude: input.displayLng,
    }
  }
  if (input.totalUnits != null) schema.numberOfAccommodationUnits = input.totalUnits
  if (input.completionDate)     schema.yearBuilt = input.completionDate.slice(0, 4)
  if (input.amenities && input.amenities.length > 0) {
    schema.amenityFeature = input.amenities.map((name) => ({
      "@type": "LocationFeatureSpecification",
      name,
      value:   true,
    }))
  }
  return schema
}

/**
 * BreadcrumbList — surfaces site hierarchy in the SERP listing.
 * Google renders these as a stacked path under the page title
 * (Home › Marketplace › Apartamento en Escazú) which both helps
 * users orient and is shown to bump click-through rate.
 *
 * Items must be passed in display order (root → current).
 */
export function buildBreadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    "@context":       "https://schema.org",
    "@type":          "BreadcrumbList",
    itemListElement:  items.map((item, idx) => ({
      "@type":    "ListItem",
      position:   idx + 1,
      name:       item.name,
      item:       item.url,
    })),
  }
}

interface AgentSchemaInput {
  name:         string
  url:          string                  // canonical agent profile URL
  imageUrl?:    string | null
  description?: string | null           // bio
  phone?:       string | null
  email?:       string | null
  /** Optional zone list — e.g. ["Escazú", "Santa Ana"]. When present
   *  we expose the first zone as addressLocality so Google can fold
   *  the agent into local-pack results for that canton. */
  zones?:       string[] | null
}

/**
 * RealEstateAgent schema for public agent profile pages. Helps the
 * profile rank for queries like "agente inmobiliario en San José" by
 * giving Google a structured business entity it can map into the
 * local-results pack.
 *
 * Phone is already publicly visible on the profile page, so exposing
 * it in schema isn't a privacy regression — and it removes Google's
 * "missing telephone" warning. Email is omitted (more PII-sensitive,
 * Google doesn't require it for the RealEstateAgent rich result).
 */
export function buildAgentJsonLd(input: AgentSchemaInput) {
  const schema: Record<string, unknown> = {
    "@context":   "https://schema.org",
    "@type":      "RealEstateAgent",
    name:         input.name,
    url:          input.url,
    areaServed: {
      "@type":  "Country",
      name:     "Costa Rica",
    },
    // priceRange is required by LocalBusiness-derived types. Real-
    // estate agents handle a wide spectrum so "$$" is intentionally
    // generic — Google still wants the field populated to qualify
    // for local-pack inclusion.
    priceRange: "$$",
  }

  // Address — exposes the first zone as locality so the agent can
  // surface in local-pack queries (e.g. "agente inmobiliario Escazú").
  // Falls back to a country-level address when no zones are set.
  const firstZone = input.zones?.find((z) => z && z.trim()) ?? null
  schema.address = {
    "@type":         "PostalAddress",
    addressCountry:  "CR",
    addressRegion:   "Costa Rica",
    ...(firstZone ? { addressLocality: firstZone } : {}),
  }

  if (input.imageUrl)     schema.image       = input.imageUrl
  if (input.description)  schema.description = input.description
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000)
  if (input.phone)        schema.telephone   = input.phone
  if (input.email)        schema.email       = input.email
  return schema
}

/**
 * hreflang + canonical builder for next-intl routes. Pass the path
 * WITHOUT the locale prefix (`/marketplace`, `/p/some-slug`) and the
 * current locale; we return the shape the Next `Metadata.alternates`
 * field expects.
 *
 * `x-default` always points at the Spanish version — that's the home
 * locale and what we want crawlers to surface to non-mapped locales.
 */
export function buildHreflangAlternates(args: {
  path:    string
  locale:  string
  baseUrl: string
}) {
  const path    = args.path.startsWith("/") ? args.path : `/${args.path}`
  const baseUrl = args.baseUrl.replace(/\/$/, "")
  return {
    canonical: `${baseUrl}/${args.locale}${path}`,
    languages: {
      es:          `${baseUrl}/es${path}`,
      en:          `${baseUrl}/en${path}`,
      "x-default": `${baseUrl}/es${path}`,
    },
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
