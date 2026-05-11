// POST /api/contracts/:id/generate-description
//
// Generates a contract-ready property description for the
// `property.description` field of `contract_data`. Returns plain
// prose; the caller is responsible for setting it on contract_data
// and saving (PATCH /api/contracts/:id).
//
// We don't auto-save here so the agent can preview the AI output
// before committing it to the structured payload.

import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { ContractDataSchema } from "@/types/contracts"
import { describeProperty } from "@/lib/contracts/contract-description-ai-service"

export const runtime = "nodejs"
export const maxDuration = 60

interface Params { params: Promise<{ id: string }> }

const Body = z.object({
  /** Optional override — when omitted, we use the contract's stored
   *  contract_data. Passing the unsaved client state lets the agent
   *  preview a description without saving first. */
  contract_data: z.unknown().optional(),
})

export async function POST(req: Request, { params }: Params) {
  await requireAuth()
  const { id }   = await params
  const supabase = await createClient()

  const body   = await req.json().catch(() => ({}))
  const parsed = Body.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 })
  }

  // Load the contract — needed for the property snapshot (amenities,
  // is_furnished, etc. that aren't in `contract_data`).
  const { data: contract } = await supabase
    .from("contracts")
    .select(`
      id, contract_data, property_id,
      property:properties(id, property_type, bedrooms, bathrooms,
        parking_spaces, area_sqm, is_furnished, amenities)
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (!contract) {
    return NextResponse.json({ error: "Contrato no encontrado." }, { status: 404 })
  }

  type Joined = {
    property: {
      property_type:  string | null
      bedrooms:       number | null
      bathrooms:      number | null
      parking_spaces: number | null
      area_sqm:       number | null
      is_furnished:   boolean | null
      amenities:      string[] | null
    } | null
  }
  const c = contract as unknown as typeof contract & Joined

  // Prefer the unsaved client state when provided, fall back to the
  // last persisted state.
  const dataParsed = ContractDataSchema.safeParse(parsed.data.contract_data ?? c.contract_data)
  if (!dataParsed.success) {
    return NextResponse.json({ error: "Datos del contrato inválidos." }, { status: 400 })
  }
  const data = dataParsed.data

  try {
    const description = await describeProperty({
      property_type:    c.property?.property_type   ?? null,
      bedrooms:         data.property.bedrooms      || c.property?.bedrooms       || 0,
      bathrooms:        data.property.bathrooms     || c.property?.bathrooms      || 0,
      parking_spaces:   data.property.parking_spaces || c.property?.parking_spaces || 0,
      area_sqm:         c.property?.area_sqm        ?? null,
      is_furnished:     c.property?.is_furnished    ?? null,
      amenities:        c.property?.amenities       ?? [],
      condominium_name: data.property.condominium_name,
      current_description: data.property.description,
    })

    return NextResponse.json({ description })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error generando descripción."
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
