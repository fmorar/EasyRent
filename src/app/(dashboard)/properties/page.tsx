import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { PlusIcon as Plus } from "@heroicons/react/24/outline"
import { PropertyCard } from "@/components/property/property-card"
import type { Property } from "@/types"

export default async function PropertiesPage() {
  const { profile } = await requireAuth()
  const supabase    = await createClient()
  const isAdmin     = profile.role === "owner_admin"

  // Admin sees all; agent sees own + shared-with-them (RLS handles this)
  const { data: propertiesRaw } = await supabase
    .from("properties")
    .select(`
      *,
      property_photos!inner(url, is_cover, order_index)
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  const properties = propertiesRaw as Property[] | null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Properties</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin ? "All properties in the platform" : "Your properties and shared listings"}
          </p>
        </div>
        <Link href="/properties/new" className={buttonVariants()}>
          <Plus className="h-4 w-4 mr-2" />
          Add property
        </Link>
      </div>

      {!properties?.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">No properties yet.</p>
          <Link href="/properties/new" className={buttonVariants({ variant: "outline", size: "sm" }) + " mt-4"}>
            Add your first property
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              currentUserId={profile.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
