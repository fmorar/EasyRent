import Link from "next/link"
import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getTranslations } from "next-intl/server"
import { ArrowLeftIcon } from "@heroicons/react/24/outline"
import {
  NewContractWizard, type LeadOption,
} from "@/components/contracts/new-contract-wizard"
import type { PropertyOption } from "@/components/market-analysis/property-selector"
import { LegalDisclaimerBanner } from "@/components/contracts/legal-disclaimer-banner"

export default async function NewContractPage() {
  await requireAuth()
  const supabase = await createClient()
  const t        = await getTranslations("contracts.wizard")

  const [propertiesRes, leadsRes] = await Promise.all([
    supabase
      .from("properties")
      .select(`
        id, title, slug, property_type, listing_type, bedrooms,
        bathrooms, parking_spaces, area_sqm, maintenance_fee, price,
        currency, display_address,
        property_photos!inner(url, is_cover, order_index)
      `)
      .is("deleted_at", null)
      .eq("listing_type", "rent")
      .order("created_at", { ascending: false }),
    supabase
      .from("leads")
      .select("id, full_name, email, phone")
      .is("deleted_at", null)
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .limit(200),
  ])

  // Pick a cover photo per property (first by is_cover desc, then order_index).
  type PropRow = Omit<PropertyOption, "cover_url"> & {
    property_photos: { url: string; is_cover: boolean; order_index: number }[]
  }
  const properties: PropertyOption[] = ((propertiesRes.data ?? []) as unknown as PropRow[])
    .map((p): PropertyOption => {
      const cover = [...p.property_photos]
        .sort((a, b) =>
          a.is_cover === b.is_cover
            ? a.order_index - b.order_index
            : (a.is_cover ? -1 : 1),
        )[0]
      return {
        id:               p.id,
        title:            p.title,
        slug:             p.slug,
        property_type:    p.property_type,
        listing_type:     p.listing_type,
        bedrooms:         p.bedrooms,
        bathrooms:        p.bathrooms,
        parking_spaces:   p.parking_spaces,
        area_sqm:         p.area_sqm,
        maintenance_fee:  p.maintenance_fee,
        price:            p.price,
        currency:         p.currency,
        display_address:  p.display_address,
        cover_url:        cover?.url ?? null,
      }
    })

  const leads: LeadOption[] = (leadsRes.data ?? []).map((l) => ({
    id:        l.id,
    full_name: l.full_name,
    email:     l.email,
    phone:     l.phone,
  }))

  return (
    <div className="mx-auto max-w-3xl space-y-(--spacing-section) py-(--spacing-cluster)">
      <div className="space-y-(--spacing-tight)">
        <Link
          href="/contracts"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          {t("backToList")}
        </Link>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <LegalDisclaimerBanner />

      <NewContractWizard properties={properties} leads={leads} />
    </div>
  )
}
