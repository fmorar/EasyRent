import { requireAuth } from "@/lib/auth"
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
  const isAdmin     = profile.role === "owner_admin"
  const t           = await getTranslations("properties")

  // Admin sees all; agent sees own + shared-with-them (RLS handles this).
  // NOTE: left-join on property_photos (no `!inner`) so drafts with zero
  // photos still appear in the list.
  const { data: propertiesRaw } = await supabase
    .from("properties")
    .select(`
      *,
      property_photos(url, is_cover, order_index)
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  const properties = propertiesRaw as Property[] | null

  return (
    <div className="space-y-(--spacing-section)">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin ? t("subtitleAdmin") : t("subtitleAgent")}
          </p>
        </div>
        <Link href="/properties/new" className={buttonVariants()}>
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
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  )
}
