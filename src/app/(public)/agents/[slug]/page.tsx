// Agent public profile — shows the agent's properties + shared-with-them properties.
// Contact shown on each property card = that agent's contact (not the original owner's).
// This is the contextual publishing model in action.

import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { MarketplaceCard } from "@/components/property/marketplace-card"
import { PhoneIcon as Phone, EnvelopeIcon as Mail } from "@heroicons/react/24/outline"
import type { Metadata } from "next"
import type { Profile } from "@/types"

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase  = await createClient()

  const { data } = await supabase
    .from("profiles")
    .select("full_name, bio")
    .eq("slug", slug)
    .eq("status", "active")
    .single() as { data: Pick<Profile, "full_name" | "bio"> | null }

  if (!data) return {}

  return {
    title:       `${data.full_name} — Real Estate Agent`,
    description: data.bio ?? undefined,
  }
}

export default async function AgentProfilePage({ params }: Props) {
  const { slug } = await params
  const supabase  = await createClient()

  // Fetch agent profile (public data only — no deleted or inactive profiles)
  const { data: agent } = await supabase
    .from("profiles")
    .select("id, full_name, slug, avatar_url, bio, phone, email, role")
    .eq("slug", slug)
    .eq("status", "active")
    .is("deleted_at", null)
    .single() as { data: Pick<Profile, "id" | "full_name" | "slug" | "avatar_url" | "bio" | "phone" | "email" | "role"> | null }

  if (!agent) notFound()

  // Call the DB function that returns own + shared-with-approved properties
  // The function resolves contact_user_id = agent.id for all rows returned
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: properties } = await (supabase as any).rpc(
    "get_agent_profile_properties",
    { p_agent_id: agent.id }
  ) as { data: import("@/types").AgentProfileProperty[] | null }

  const initials = agent.full_name
    .split(" ")
    .map((n: string) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Agent hero */}
      <div className="flex flex-col sm:flex-row items-start gap-6">
        <Avatar className="h-20 w-20 shrink-0">
          <AvatarImage src={agent.avatar_url ?? undefined} alt={agent.full_name} />
          <AvatarFallback className="text-xl">{initials}</AvatarFallback>
        </Avatar>

        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{agent.full_name}</h1>
            <Badge variant="secondary">
              {agent.role === "owner_admin" ? "Agency" : "Agent"}
            </Badge>
          </div>

          {agent.bio && (
            <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
              {agent.bio}
            </p>
          )}

          {/* Contact — shown because this is the branded agent profile */}
          <div className="flex flex-wrap gap-4 text-sm">
            {agent.phone && (
              <a
                href={`tel:${agent.phone}`}
                className="flex items-center gap-1 text-foreground hover:underline underline-offset-4 decoration-primary decoration-2"
              >
                <Phone className="h-3.5 w-3.5" />
                {agent.phone}
              </a>
            )}
            {agent.email && (
              <a
                href={`mailto:${agent.email}`}
                className="flex items-center gap-1 text-foreground hover:underline underline-offset-4 decoration-primary decoration-2"
              >
                <Mail className="h-3.5 w-3.5" />
                {agent.email}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Property listings */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          Properties ({properties?.length ?? 0})
        </h2>

        {!properties?.length ? (
          <p className="text-sm text-muted-foreground">
            No properties listed at this time.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((property) => (
              // MarketplaceCard receives contact_user_id so it knows whose
              // phone/email to display. For agent profiles, contact = this agent.
              <MarketplaceCard
                key={property.property_id}
                property={{
                  id:              property.property_id,
                  slug:            property.property_id, // agent profile cards link by id
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
                }}
                coverUrl={property.cover_url ?? undefined}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
