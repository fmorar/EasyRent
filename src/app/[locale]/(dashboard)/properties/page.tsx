import { requireAuth } from "@/lib/auth"
import { isAdminRole } from "@/lib/roles"
import { createClient } from "@/lib/supabase/server"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { BuildingOffice2Icon, PlusIcon as Plus } from "@heroicons/react/24/outline"
import { PropertyCard } from "@/components/property/property-card"
import { EmptyState } from "@/components/shared/empty-state"
import type { Property } from "@/types"

export default async function PropertiesPage() {
  const { profile } = await requireAuth()
  const supabase    = await createClient()
  const isAdmin     = isAdminRole(profile.role)
  const t           = await getTranslations("properties")

  // Show only properties the user actually owns or was approved to access
  // via a share. We can't rely on RLS alone here because the public
  // marketplace SELECT policy also matches every marketplace-visible row
  // for any authenticated user — that would pollute this dashboard list
  // with strangers' published listings.
  const { data: sharedRows } = await supabase
    .from("property_shares")
    .select("property_id")
    .eq("shared_with", profile.id)
    .eq("status",      "approved")
    .is("deleted_at",  null)

  const sharedIds = (sharedRows ?? []).map((r) => r.property_id)
  const scope = sharedIds.length > 0
    ? `created_by.eq.${profile.id},id.in.(${sharedIds.join(",")})`
    : `created_by.eq.${profile.id}`

  // NOTE: left-join on property_photos (no `!inner`) so drafts with zero
  // photos still appear in the list.
  const { data: propertiesRaw } = await supabase
    .from("properties")
    .select(`
      *,
      property_photos(url, is_cover, order_index),
      creator:profiles!properties_created_by_fkey(full_name)
    `)
    .or(scope)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  // The creator join lives on `property.creator`, but the rest of the
  // app treats rows as plain Property; keep the cast narrow here so
  // the card can read the name without bloating the Property type.
  type PropertyWithCreator = Property & { creator?: { full_name: string } | null }
  const properties = propertiesRaw as PropertyWithCreator[] | null

  return (
    <div className="space-y-(--spacing-section)">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("subtitleAgent")}
          </p>
        </div>
        <Link
          href="/properties/new"
          className={buttonVariants()}
          data-tour="new-property-cta"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t("addProperty")}
        </Link>
      </div>

      {!properties?.length ? (
        <EmptyState
          icon={<BuildingOffice2Icon className="h-8 w-8" />}
          message={t("noProperties")}
          action={
            <Link
              href="/properties/new"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {t("addFirst")}
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              currentUserId={profile.id}
              currentUserSlug={profile.slug}
              isAdmin={isAdmin}
              creatorName={property.creator?.full_name ?? null}
            />
          ))}
        </div>
      )}
    </div>
  )
}
