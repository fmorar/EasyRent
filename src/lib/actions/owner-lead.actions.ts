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

  // Fire-and-forget email to the platform owner so the lead doesn't
  // sit in the DB unread. Goes to the first super_admin (only one in
  // production today). Never blocks the form submission — if Resend
  // is down or there's no super_admin, the row is still saved.
  void notifyOwnerLeadRecipientInBackground({
    leadId:        data.id,
    leadName:      fullName,
    leadEmail:     input.email?.trim() || null,
    leadPhone:     phone,
    message:       input.message?.trim() || null,
    intent:        input.intent,
    propertyType:  input.property_type?.trim() || null,
    zone:          input.zone?.trim()          || null,
    sourceContext: input.source_context ?? null,
  })

  return { success: true, data: { id: data.id } }
}

// Look up the platform owner inbox + dispatch the notification email.
// The owner-intake form doesn't have a `captured_by` like the public
// lead form does — every submission routes to the first super_admin
// (there's exactly one in production today).
async function notifyOwnerLeadRecipientInBackground(args: {
  leadId:        string
  leadName:      string
  leadEmail:     string | null
  leadPhone:     string | null
  message:       string | null
  intent:        "sale" | "rent" | "both"
  propertyType:  string | null
  zone:          string | null
  sourceContext: string | null
}) {
  try {
    const { sendLeadNotificationEmail } = await import(
      "@/lib/email/send-lead-notification"
    )

    const admin = createAdminClient()
    const { data: superAdmin } = await admin
      .from("profiles")
      .select("id, email, full_name")
      .eq("role", "super_admin")
      .limit(1)
      .single()

    if (!superAdmin?.email) {
      console.warn("[owner-lead.notify] no super_admin email — lead", args.leadId)
      return
    }

    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
      ?? "https://www.easyrent.house"
    )
    const inboxUrl = `${appUrl}/leads`

    // Owner-intake → "Vender / Alquilar / Decidiendo" + property type
    // + zone, rendered as labelled rows under the message block.
    const intentLabel = INTENT_LABELS_ES[args.intent]
    const propertyTypeLabel = args.propertyType
      ? PROPERTY_TYPE_LABELS_ES[args.propertyType] ?? args.propertyType
      : null

    const details: Array<{ label: string; value: string }> = []
    details.push({ label: "Intención",   value: intentLabel })
    if (propertyTypeLabel) details.push({ label: "Tipo de propiedad", value: propertyTypeLabel })
    if (args.zone)         details.push({ label: "Zona",              value: args.zone })

    const firstName = args.leadName.trim().split(/\s+/)[0] || args.leadName

    await sendLeadNotificationEmail({
      to:            superAdmin.email,
      agentName:     superAdmin.full_name ?? "Equipo easyrent",
      leadName:      args.leadName,
      leadEmail:     args.leadEmail,
      leadPhone:     args.leadPhone,
      message:       args.message,
      sourceLabel:   "Solicitud de valoración",
      sourceContext: args.sourceContext,
      listing:       null,                              // no listing scope
      details,
      // Custom copy so the email reads right for an owner asking for
      // a valuation rather than a buyer/renter asking about a unit.
      headline:      `${args.leadName} quiere ${INTENT_HEADLINE_VERB[args.intent]}`,
      subject:       `Nueva valoración solicitada · ${firstName}`,
      inboxUrl,
    })
  } catch (err) {
    console.error("[owner-lead.notify] failed for lead", args.leadId, err)
  }
}

// Owner-intake intent → readable Spanish label for the details row.
const INTENT_LABELS_ES: Record<"sale" | "rent" | "both", string> = {
  sale: "Vender mi propiedad",
  rent: "Alquilar mi propiedad",
  both: "Aún estoy decidiendo",
}

// Verb fragment for the headline — "{name} quiere {verb}".
const INTENT_HEADLINE_VERB: Record<"sale" | "rent" | "both", string> = {
  sale: "vender su propiedad",
  rent: "alquilar su propiedad",
  both: "vender o alquilar su propiedad",
}

// Property-type label used in the details block. We hardcode here
// instead of importing from labels.ts because owner-intake accepts
// strings (free-form) — guards against unknown values gracefully.
const PROPERTY_TYPE_LABELS_ES: Record<string, string> = {
  apartment:  "Apartamento",
  house:      "Casa",
  land:       "Terreno",
  commercial: "Local comercial",
  office:     "Oficina",
  warehouse:  "Bodega",
}
