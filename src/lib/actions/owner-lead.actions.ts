"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import type { ActionResult } from "@/types"

export interface OwnerLeadInput {
  full_name:       string
  phone:           string
  email?:          string
  intent:          "sale" | "rent" | "both"
  property_type?:  string
  zone?:           string
  bedrooms?:       number
  bathrooms?:      number
  area_sqm?:       number
  expected_price?: number
  currency?:       "USD" | "CRC"
  message?:        string
  source_context?: string
  locale?:         string
}

/**
 * Capture a property-owner intake submission from the public
 * `/contacto` page. Uses the admin client to bypass RLS — the table
 * also has a public INSERT policy, so even if this server action
 * ever ran with the anon key it would still work.
 *
 * Light shape validation only; the form does the full check client-
 * side. We don't dedupe (same person can legitimately submit twice
 * with different properties), but we trim strings to avoid storing
 * accidental whitespace.
 */
export async function submitOwnerLead(
  input: OwnerLeadInput,
): Promise<ActionResult<{ id: string }>> {
  const fullName = (input.full_name ?? "").trim()
  const phone    = (input.phone     ?? "").trim()

  if (!fullName) return { success: false, error: "Falta tu nombre." }
  if (!phone)    return { success: false, error: "Falta un teléfono de contacto." }
  if (!["sale", "rent", "both"].includes(input.intent)) {
    return { success: false, error: "Indicá si querés vender, alquilar o ambas." }
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from("owner_leads")
    .insert({
      full_name:      fullName,
      phone,
      email:          input.email?.trim()         || null,
      intent:         input.intent,
      property_type:  input.property_type?.trim() || null,
      zone:           input.zone?.trim()          || null,
      bedrooms:       input.bedrooms       ?? null,
      bathrooms:      input.bathrooms      ?? null,
      area_sqm:       input.area_sqm       ?? null,
      expected_price: input.expected_price ?? null,
      currency:       input.currency       ?? null,
      message:        input.message?.trim()       || null,
      source_context: input.source_context        ?? null,
      locale:         input.locale === "en" ? "en" : "es",
    })
    .select("id")
    .single()

  if (error) return { success: false, error: error.message }

  return { success: true, data: { id: data.id } }
}
