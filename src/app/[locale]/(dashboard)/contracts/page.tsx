import Link from "next/link"
import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getTranslations } from "next-intl/server"
import { buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { DocumentTextIcon as FileText, PlusIcon } from "@heroicons/react/24/outline"
import { ContractsTable } from "@/components/contracts/contracts-table"
import { LegalDisclaimerBanner } from "@/components/contracts/legal-disclaimer-banner"
import type { ContractListItem, ContractStatusLifecycle } from "@/types/contracts"

export default async function ContractsPage() {
  await requireAuth()
  const supabase = await createClient()
  const t        = await getTranslations("contracts")

  // Fetch list — RLS filters down to contracts the user can see.
  const { data: rows } = await supabase
    .from("contracts")
    .select(`
      id, title, status, contract_type, property_id,
      contract_data, created_at, updated_at,
      property:properties(id, title),
      lead:leads(id, full_name)
    `)
    .eq("contract_type", "rental")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  const contracts: ContractListItem[] = (rows ?? []).map((row) => {
    type Joined = {
      property: { id: string; title: string } | null
      lead:     { id: string; full_name: string } | null
    }
    const r  = row as unknown as typeof row & Joined
    const cd = (r.contract_data ?? {}) as {
      payments?: { rent_amount?: number; rent_currency?: "USD" | "CRC" }
      terms?:    { start_date?: string }
    }
    return {
      id:             r.id,
      title:          r.title,
      status:         (r.status as ContractStatusLifecycle),
      contract_type:  "rental" as const,
      property_id:    r.property_id,
      property_title: r.property?.title ?? null,
      tenant_name:    r.lead?.full_name ?? null,
      rent_amount:    cd.payments?.rent_amount    ?? null,
      rent_currency:  cd.payments?.rent_currency  ?? null,
      start_date:     cd.terms?.start_date        ?? null,
      created_at:     r.created_at,
      updated_at:     r.updated_at,
    }
  })

  return (
    <div className="space-y-(--spacing-section)">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        <Link href="/contracts/new" className={buttonVariants()}>
          <PlusIcon className="h-4 w-4" />
          {t("newContract")}
        </Link>
      </header>

      <LegalDisclaimerBanner />

      {contracts.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title={t("emptyTitle")}
          message={t("emptyBody")}
          action={
            <Link href="/contracts/new" className={buttonVariants()}>
              <PlusIcon className="h-4 w-4" />
              {t("newContract")}
            </Link>
          }
        />
      ) : (
        <ContractsTable contracts={contracts} />
      )}
    </div>
  )
}
