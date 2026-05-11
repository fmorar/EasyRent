import { notFound } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import {
  ContractDataSchema,
  emptyContractData,
} from "@/types/contracts"
import { generateContractDraft } from "@/lib/contracts/contract-generation-service"
import { ContractDetailClient } from "@/components/contracts/contract-detail-client"
import type { Contract } from "@/types"

interface Params { params: Promise<{ id: string }> }

export default async function ContractDetailPage({ params }: Params) {
  await requireAuth()
  const { id }   = await params
  const supabase = await createClient()

  const { data: contract } = await supabase
    .from("contracts")
    .select(`
      *,
      property:properties(id, title, slug, display_address),
      lead:leads(id, full_name, email, phone),
      owner:owners(id, full_name, email, phone, id_number),
      template:contract_templates(id, name, template_content)
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (!contract) notFound()

  type Joined = {
    property: { id: string; title: string; slug: string; display_address: string | null } | null
    lead:     { id: string; full_name: string; email: string | null; phone: string | null } | null
    owner:    { id: string; full_name: string; email: string | null; phone: string | null; id_number: string | null } | null
    template: { id: string; name: string; template_content: string | null } | null
  }
  const c = contract as unknown as Contract & Joined

  // Parse contract_data through the Zod schema. If a row was created
  // before a schema field was added, parse fills defaults.
  const parsed = ContractDataSchema.safeParse(c.contract_data)
  const data   = parsed.success ? parsed.data : emptyContractData()

  // Recompute warnings/missing on every load so the UI stays current.
  const generated = c.template?.template_content
    ? generateContractDraft({
        template_html: c.template.template_content,
        contract_data: data,
      })
    : null

  return (
    <ContractDetailClient
      contract={c}
      initialData={data}
      // When the persisted editor HTML is empty (fresh contract OR a
      // template change busted the cache), fall back to the freshly
      // generated draft so the user sees content immediately.
      initialHtml={(c.editor_content_html && c.editor_content_html.trim().length > 0)
        ? c.editor_content_html
        : (generated?.html ?? "")}
      templateHtml={c.template?.template_content ?? ""}
      warnings={generated?.warnings ?? []}
      missingFields={generated?.missing_fields ?? []}
      property={c.property}
      tenant={c.lead}
      owner={c.owner}
    />
  )
}
