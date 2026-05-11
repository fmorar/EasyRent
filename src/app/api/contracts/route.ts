// GET  /api/contracts  → list contracts visible to the current user
// POST /api/contracts  → create a new contract draft

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { createContract } from "@/lib/actions/contract.actions"

export const runtime = "nodejs"

export async function GET() {
  await requireAuth()
  const supabase = await createClient()

  // Hand-off to RLS for filtering. We project to the shape the
  // <ContractsTable> component consumes.
  const { data, error } = await supabase
    .from("contracts")
    .select(`
      id, title, status, contract_type, property_id, lead_id,
      contract_data, created_at, updated_at,
      property:properties(id, title, slug),
      lead:leads(id, full_name)
    `)
    .eq("contract_type", "rental")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Flatten the joined data into a list-friendly shape.
  const list = (data ?? []).map((row) => {
    type Joined = {
      property: { id: string; title: string; slug: string } | null
      lead:     { id: string; full_name: string }           | null
    }
    const r = row as unknown as typeof row & Joined
    const cd = (r.contract_data ?? {}) as { payments?: { rent_amount?: number; rent_currency?: string }; terms?: { start_date?: string } }
    return {
      id:             r.id,
      title:          r.title,
      status:         r.status,
      contract_type:  r.contract_type,
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

  return NextResponse.json({ contracts: list })
}

// Note: we don't use Zod's strict `.uuid()` here. Zod 4's UUID
// validator checks the version bits, which rejects legitimate row
// ids in our seed data (e.g. `40000000-0000-0000-0000-...`). The FK
// constraint at the DB layer rejects non-existent IDs anyway, so a
// shape check is enough at this boundary.
const CreateBody = z.object({
  property_id: z.string().min(1),
  lead_id:     z.string().min(1).nullable().optional(),
  owner_id:    z.string().min(1).nullable().optional(),
  template_id: z.string().min(1).nullable().optional(),
})

export async function POST(req: Request) {
  await requireAuth()
  const body = await req.json().catch(() => ({}))
  const parsed = CreateBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 })
  }
  const result = await createContract({
    property_id: parsed.data.property_id,
    lead_id:     parsed.data.lead_id     ?? null,
    owner_id:    parsed.data.owner_id    ?? null,
    template_id: parsed.data.template_id ?? null,
  })
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json(result.data, { status: 201 })
}
