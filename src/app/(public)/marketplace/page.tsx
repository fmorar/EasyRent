import { createClient } from "@/lib/supabase/server"
import { MarketplaceCard } from "@/components/property/marketplace-card"
import type { MarketplaceProperty } from "@/types"

export const revalidate = 60 // revalidate every 60s

export default async function MarketplacePage() {
  const supabase = await createClient()

  const { data: properties } = await supabase
    .from("v_marketplace")
    .select("*")
    .order("is_featured", { ascending: false })
    .order("created_at",  { ascending: false })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Property listings</h1>
        <p className="text-muted-foreground mt-2">
          {properties?.length ?? 0} properties available
        </p>
      </div>

      {!properties?.length ? (
        <div className="text-center py-20 text-muted-foreground">
          <p>No properties available at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {(properties as MarketplaceProperty[]).map((property) => (
            <MarketplaceCard key={property.id} property={property} />
          ))}
        </div>
      )}
    </div>
  )
}
