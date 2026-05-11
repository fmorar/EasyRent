// POST /api/contracts/:id/generate
//
// Regenerate the editor HTML from the structured `contract_data`.
// The wizard or editor pings this when the agent presses "Regenerar
// borrador" — useful after editing the structured data and wanting
// the prose to follow.
//
// IMPORTANT: this overwrites manual edits to editor_content_html.
// The UI must warn the user and offer "save current as version
// first" before calling this endpoint.

import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { updateContract } from "@/lib/actions/contract.actions"
import { createClient } from "@/lib/supabase/server"
import { ContractDataSchema } from "@/types/contracts"

export const runtime = "nodejs"

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  await requireAuth()
  const { id }   = await params
  const supabase = await createClient()

  // Pull the current structured data — we regenerate from THAT,
  // not from a body payload (the agent wants this to mirror their
  // last save).
  const { data: row } = await supabase
    .from("contracts")
    .select("contract_data")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const parsed = ContractDataSchema.safeParse(row.contract_data)
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos del contrato inválidos." }, { status: 400 })
  }

  const result = await updateContract({
    id,
    contract_data: parsed.data,
    regenerate:    true,
  })
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json(result.data)
}
