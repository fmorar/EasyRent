import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import { formatPrice, PROPERTY_TYPE_LABELS } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { TourForm } from "@/components/property/tour-form"
import { MapPinIcon as MapPin, ArrowsPointingOutIcon as Maximize2, TruckIcon as Car, PhoneIcon as Phone, EnvelopeIcon as Mail, ChatBubbleLeftIcon as MessageCircle } from "@heroicons/react/24/outline"
import { StarIcon as Star } from "@heroicons/react/24/solid"
import type { Metadata } from "next"
import type { MarketplaceProperty, Profile } from "@/types"

interface Props {
  params: Promise<{ slug: string }>
}

const STATUS_LABELS: Record<string, string> = {
  available: "For Sale",
  reserved:  "Reserved",
  sold:      "Sold",
  off_market:"Off Market",
  rented:    "Rented",
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase  = await createClient()

  const { data } = await supabase
    .from("v_marketplace")
    .select("title, description")
    .eq("slug", slug)
    .single() as { data: Pick<MarketplaceProperty, "title" | "description"> | null }

  if (!data) return {}
  return { title: data.title, description: data.description ?? undefined }
}

export default async function PublicPropertyPage({ params }: Props) {
  const { slug } = await params
  const supabase  = await createClient()

  const { data: property } = await supabase
    .from("v_marketplace")
    .select("*")
    .eq("slug", slug)
    .single() as { data: MarketplaceProperty | null }

  if (!property) notFound()

  // Fetch additional fields not in the view
  const { data: propExtra } = await supabase
    .from("properties")
    .select("parking_spaces, floor, created_by")
    .eq("id", property.id!)
    .single() as { data: { parking_spaces: number | null; floor: number | null; created_by: string } | null }

  // Fetch photos
  const { data: photos } = await supabase
    .from("property_photos")
    .select("url, caption, is_cover, order_index")
    .eq("property_id", property.id!)
    .order("order_index") as { data: { url: string; caption: string | null; is_cover: boolean; order_index: number }[] | null }

  // Fetch project amenities if this property belongs to a project
  const { data: amenities } = property.project_id
    ? await supabase
        .from("project_amenities")
        .select("name, icon")
        .eq("project_id", property.project_id)
        .order("sort_order")
    : { data: null }

  // Fetch admin contact for the sidebar
  const { data: admin } = await supabase
    .from("profiles")
    .select("id, full_name, slug, avatar_url, phone, email, role, bio")
    .eq("role", "owner_admin")
    .is("deleted_at", null)
    .limit(1)
    .single() as { data: Pick<Profile, "id" | "full_name" | "slug" | "avatar_url" | "phone" | "email" | "role" | "bio"> | null }

  const coverPhoto  = photos?.find((p) => p.is_cover) ?? photos?.[0]
  const sidePhoto1  = photos?.[1]
  const sidePhoto2  = photos?.[2]
  const extraPhotos = Math.max(0, (photos?.length ?? 0) - 3)

  const adminInitials = admin?.full_name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() ?? "RE"

  const parking = propExtra?.parking_spaces ?? null
  const floor   = property.floor ?? propExtra?.floor ?? null

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

      {/* ── Photo gallery ─────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 h-[420px] rounded-xl overflow-hidden">
        {/* Hero */}
        <div className="col-span-2 bg-muted relative">
          {coverPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverPhoto.url}
              alt={property.title ?? ""}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
              No photo
            </div>
          )}
          {property.is_featured && (
            <Badge className="absolute top-3 left-3">Featured</Badge>
          )}
        </div>

        {/* Side stack */}
        <div className="col-span-1 flex flex-col gap-3">
          <div className="flex-1 bg-muted relative overflow-hidden rounded-sm">
            {sidePhoto1 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sidePhoto1.url}
                alt={sidePhoto1.caption ?? ""}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-muted" />
            )}
          </div>
          <div className="flex-1 bg-muted relative overflow-hidden rounded-sm">
            {sidePhoto2 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sidePhoto2.url}
                alt={sidePhoto2.caption ?? ""}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-muted" />
            )}
            {extraPhotos > 0 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white text-2xl font-bold">+{extraPhotos}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

        {/* Left — main content */}
        <div className="lg:col-span-2 space-y-8">

          {/* Title row */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{PROPERTY_TYPE_LABELS[property.property_type!]}</Badge>
              </div>
              <h1 className="text-3xl font-bold leading-tight">{property.title}</h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                {property.display_address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {property.display_address}
                  </span>
                )}
                <span className="flex items-center gap-1 text-foreground">
                  <Star className="h-3.5 w-3.5 fill-foreground stroke-foreground" />
                  <span className="font-medium">5.0</span>
                </span>
              </div>
            </div>
            <div className="shrink-0">
              <p className="text-3xl font-bold text-foreground font-numeric">
                {formatPrice(property.price!, property.currency!)}
              </p>
              <p className="text-xs text-muted-foreground text-right">{property.currency}</p>
            </div>
          </div>

          <Separator />

          {/* Description */}
          {property.description && (
            <div className="space-y-3">
              <h2 className="text-lg font-heading font-semibold">Description</h2>
              <div
                className="preview-prose text-sm text-muted-foreground leading-relaxed"
                dangerouslySetInnerHTML={{ __html: property.description }}
              />
            </div>
          )}

          {/* Key Features */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Key Features:</h2>
            <div className="border rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Amenities
              </h3>
              <Separator />
              {/* Core specs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {property.bedrooms != null && (
                  <FeatureItem icon={null} label={`${property.bedrooms} Bed${property.bedrooms !== 1 ? "s" : ""}`} />
                )}
                {property.bathrooms != null && (
                  <FeatureItem icon={null} label={`${property.bathrooms} Bath${property.bathrooms !== 1 ? "s" : ""}`} />
                )}
                {property.area_sqm != null && (
                  <FeatureItem icon={<Maximize2 className="h-4 w-4" />} label={`${property.area_sqm} m²`} />
                )}
                {parking != null && (
                  <FeatureItem icon={<Car className="h-4 w-4" />} label={`${parking} Parking`} />
                )}
              </div>
              {/* Project amenities */}
              {amenities && amenities.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {amenities.map((a) => (
                    <FeatureItem key={a.name} icon={<span className="h-4 w-4 text-base leading-none">·</span>} label={a.name} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Areas & Lot */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Areas &amp; Lot</h2>
            <div className="border rounded-xl divide-y">
              <DetailRow label="Status"      value={STATUS_LABELS[property.status!] ?? property.status!} />
              {property.display_address && (
                <DetailRow label="Location"   value={property.display_address} />
              )}
              {property.area_sqm != null && (
                <DetailRow label="Living Space" value={`${property.area_sqm.toLocaleString()} m²`} />
              )}
              {floor != null && (
                <DetailRow label="Floor"      value={`${floor}`} />
              )}
              {parking != null && (
                <DetailRow label="Parking"    value={`${parking} space${parking !== 1 ? "s" : ""}`} />
              )}
              <DetailRow
                label="Property ID"
                value={property.id?.slice(0, 8).toUpperCase() ?? "—"}
              />
            </div>
          </div>
        </div>

        {/* Right — sidebar */}
        <div className="lg:col-span-1 space-y-6">

          {/* Agent contact card */}
          {admin && (
            <div className="border rounded-xl p-5 space-y-4 sticky top-24">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 shrink-0">
                  <AvatarImage src={admin.avatar_url ?? undefined} alt={admin.full_name} />
                  <AvatarFallback>{adminInitials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-sm">{admin.full_name}</p>
                  {admin.bio && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{admin.bio}</p>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                {admin.phone && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" /> Phone
                      </span>
                      <a href={`tel:${admin.phone}`} className="font-medium hover:underline text-right">
                        {admin.phone}
                      </a>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </span>
                      <a
                        href={`https://wa.me/${admin.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:underline text-right"
                      >
                        {admin.phone}
                      </a>
                    </div>
                  </>
                )}
                {admin.email && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" /> Email
                    </span>
                    <a href={`mailto:${admin.email}`} className="font-medium hover:underline text-right truncate max-w-[160px]">
                      {admin.email}
                    </a>
                  </div>
                )}
              </div>

              <Link
                href={`/agents/${admin.slug}`}
                className={cn(buttonVariants({ variant: "default" }), "w-full justify-center")}
              >
                View My Properties
              </Link>

              <Separator />

              {/* Schedule tour form */}
              <div>
                <h3 className="font-semibold text-sm mb-1">Schedule tour</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  See this property up close — book a visit today.
                </p>
                <TourForm
                  propertyId={property.id!}
                  propertyName={property.title!}
                  propertySlug={property.slug!}
                  capturedBy={propExtra?.created_by ?? null}
                />
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

function FeatureItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="text-foreground">{icon}</span>
      <span>{label}</span>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center px-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}
