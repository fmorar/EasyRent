// POST /api/contracts/:id/finalize
// Move status `draft` → `finalized` after passing the validation
// gate. Returns 400 with the list of blockers when not finalizable.

import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { finalizeContract } from "@/lib/actions/contract.actions"

export const runtime = "nodejs"

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  await requireAuth()
  const { id } = await params
  const result = await finalizeContract(id)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json(result.data)
}
