// GET    /api/contracts/:id   → contract detail (row + warnings + missing)
// PATCH  /api/contracts/:id   → update contract_data and/or editor content
// DELETE /api/contracts/:id   → archive (soft)

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import {
  archiveContract,
  updateContract,
} from "@/lib/actions/contract.actions"
import { ContractDataSchema } from "@/types/contracts"
import { generateContractDraft } from "@/lib/contracts/contract-generation-service"

export const runtime = "nodejs"

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  await requireAuth()
  const { id } = await params
  const supabase = await createClient()

  const { data: contract, error } = await supabase
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

  if (error)    return NextResponse.json({ error: error.message }, { status: 500 })
  if (!contract) return NextResponse.json({ error: "not_found" }, { status: 404 })

  // Re-run health-check + missing on every GET so the UI always
  // has fresh diagnostics, even if the data was edited by another
  // tab. Cheap (sync, ~ms).
  const parsedData = ContractDataSchema.safeParse(contract.contract_data)
  const tplHtml    = (contract as unknown as { template?: { template_content?: string } }).template?.template_content ?? ""
  const generated  = parsedData.success && tplHtml
    ? generateContractDraft({
        template_html: tplHtml,
        contract_data: parsedData.data,
      })
    : null

  return NextResponse.json({
    contract,
    warnings:       generated?.warnings       ?? [],
    missing_fields: generated?.missing_fields ?? [],
  })
}

const PatchBody = z.object({
  contract_data:        z.unknown().optional(),
  editor_content_html:  z.string().optional(),
  editor_content_json:  z.unknown().optional(),
  regenerate:           z.boolean().optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  await requireAuth()
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = PatchBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 })
  }

  // contract_data goes through ContractDataSchema inside the action.
  const result = await updateContract({
    id,
    contract_data:       parsed.data.contract_data as never,
    editor_content_html: parsed.data.editor_content_html,
    editor_content_json: parsed.data.editor_content_json,
    regenerate:          parsed.data.regenerate,
  })
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json(result.data)
}

export async function DELETE(_req: Request, { params }: Params) {
  await requireAuth()
  const { id } = await params
  const result = await archiveContract(id)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
