// POST /api/contracts/:id/save-version
// Snapshots the current `contract_data` + `editor_content_*` as a
// new row in `contract_versions`. Used as a "save point" before risky
// operations (regenerate, large edit).

import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth } from "@/lib/auth"
import { saveContractVersion } from "@/lib/actions/contract.actions"

export const runtime = "nodejs"

interface Params { params: Promise<{ id: string }> }

const Body = z.object({
  change_summary: z.string().max(500).optional(),
})

export async function POST(req: Request, { params }: Params) {
  await requireAuth()
  const { id } = await params
  const body   = await req.json().catch(() => ({}))
  const parsed = Body.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 })
  }
  const result = await saveContractVersion(id, parsed.data.change_summary)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json(result.data)
}
