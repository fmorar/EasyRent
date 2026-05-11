// Anonymous property link — no branding, no agent, no contact info.
// Queries v_properties_anonymous (SECURITY DEFINER view — strips sensitive fields).
// The raw `properties` table is REVOKED from anon; this view is the only access path.

import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { formatPrice, PROPERTY_TYPE_LABELS } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ArrowsPointingOutIcon as Maximize2, MapPinIcon as MapPin } from "@heroicons/react/24/outline"
import type { Metadata } from "next"
import type { AnonymousProperty } from "@/types"

interface Props {
  params: Promise<{ anonymousSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { anonymousSlug } = await params
  const supabase           = await createClient()

  const { data } = await supabase
    .from("v_properties_anonymous")
    .select("title")
    .eq("anonymous_slug", anonymousSlug)
    .single()

  // Generic title: don't reveal property identity in meta
  return { title: data ? "Property details" : "Not found" }
}

export default async function AnonymousPropertyPage({ params }: Props) {
  const { anonymousSlug } = await params
  const supabase           = await createClient()

  const { data: property } = await supabase
    .from("v_properties_anonymous")
    .select("*")
    .eq("anonymous_slug", anonymousSlug)
    .single() as { data: AnonymousProperty | null }

  if (!property) notFound()

  // Photos are safe to show (no identity data in photo rows)
  const { data: photos } = await supabase
    .from("property_photos")
    .select("url, caption, is_cover, order_index")
    .eq("property_id", property.id!)
    .order("order_index") as { data: { url: string; caption: string | null; is_cover: boolean; order_index: number }[] | null }

  const coverPhoto = photos?.find((p) => p.is_cover) ?? photos?.[0]

  return (
    <div className="min-h-screen bg-background">
      {/* No header, no branding — intentional */}
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        {/* Cover */}
        <div className="aspect-video bg-muted rounded-lg overflow-hidden">
          {coverPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverPhoto.url} alt="Property" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
              No photo available
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-4">
          <Badge variant="secondary">{PROPERTY_TYPE_LABELS[property.property_type!]}</Badge>
          <h1 className="text-2xl font-bold">{property.title}</h1>

          {property.display_address && (
            <p className="flex items-center gap-1 text-muted-foreground text-sm">
              <MapPin className="h-3.5 w-3.5" />
              {property.display_address}
              {property.location_mode === "approximate" && (
                <span className="ml-1 text-xs">(approximate area)</span>
              )}
            </p>
          )}

          <p className="text-3xl font-bold">
            {formatPrice(property.price!, property.currency!)}
          </p>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {property.bedrooms != null && (
              <span className="flex items-center gap-1">
                {property.bedrooms} bed{property.bedrooms !== 1 ? "s" : ""}
              </span>
            )}
            {property.bathrooms != null && (
              <span className="flex items-center gap-1">
                {property.bathrooms} bath{property.bathrooms !== 1 ? "s" : ""}
              </span>
            )}
            {property.area_sqm != null && (
              <span className="flex items-center gap-1">
                <Maximize2 className="h-4 w-4" /> {property.area_sqm} m²
              </span>
            )}
          </div>

          {property.description && (
            <div>
              <h2 className="font-semibold mb-2">Description</h2>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {property.description}
              </p>
            </div>
          )}
        </div>

        {/* No contact info, no agent name, no agency branding */}
        <div className="border-t pt-6 text-center text-xs text-muted-foreground">
          This is a private listing shared via anonymous link.
        </div>
      </div>
    </div>
  )
}
