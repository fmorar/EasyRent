import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendWhatsAppMessage } from "@/lib/twilio/send"
import { stripWhatsAppPrefix } from "@/lib/phone"
import { appendConversationMessage } from "@/lib/conversations"
import type { Database } from "@/types/supabase"

type Property = Database["public"]["Tables"]["properties"]["Row"]

/**
 * Re-engagement to the original lead after an owner accepts.
 *
 *   resolveReEngagement (in the webhook) finds the property + lead's
 *   conversation, then hands here. This function:
 *     1. Loads the property
 *     2. Composes a short WhatsApp message
 *     3. Sends it via Twilio (free-form, since the lead is within
 *        the 24h window if they recently triggered the search_request)
 *     4. Persists the outbound message into the lead's conversation
 *
 * Gating: if `WHATSAPP_OWNER_OUTREACH_ENABLED !== "true"` we skip the
 * actual send and just log + persist the outbound row as a "would
 * have sent" record. Same kill switch as the owner-outreach path so
 * operators flip ONE flag and the whole loop activates.
 *
 * Out-of-24h-window risk: if the lead asked for the property days
 * ago, we're outside the WA Business customer-service window and
 * Twilio will reject this send unless a template is used. For now
 * we just log the failure — Phase B refinement: use a second
 * template ("lead_match_notification") for this case.
 */
export async function reEngageLead(input: {
  propertyId:         string
  leadConversationId: string | null
}): Promise<void> {
  if (!input.leadConversationId) {
    console.log("[whatsapp.reengage] no lead conversation_id — skipping")
    return
  }
  if (process.env.WHATSAPP_OWNER_OUTREACH_ENABLED !== "true") {
    console.log("[whatsapp.reengage] outreach disabled; skipping send")
    return
  }

  const admin = createAdminClient()

  const propRes = await admin
    .from("properties")
    .select("id, slug, title, price, currency, listing_type, bedrooms, bathrooms, area_sqm, display_address")
    .eq("id", input.propertyId)
    .single()
  if (propRes.error || !propRes.data) {
    console.warn("[whatsapp.reengage] property not found", input.propertyId)
    return
  }
  const property = propRes.data as Pick<Property,
    "id" | "slug" | "title" | "price" | "currency" | "listing_type"
    | "bedrooms" | "bathrooms" | "area_sqm" | "display_address"
  >

  const convRes = await admin
    .from("conversations")
    .select("id, lead_id, external_id, kind")
    .eq("id", input.leadConversationId)
    .single()
  if (convRes.error || !convRes.data) {
    console.warn("[whatsapp.reengage] conversation not found", input.leadConversationId)
    return
  }
  if (convRes.data.kind !== "lead") {
    console.warn("[whatsapp.reengage] conversation is not a lead thread — refusing", input.leadConversationId)
    return
  }
  const leadPhone = convRes.data.external_id
  if (!leadPhone) {
    console.warn("[whatsapp.reengage] conversation has no phone", input.leadConversationId)
    return
  }

  const body = buildReEngagementMessage(property)

  const sendRes = await sendWhatsAppMessage({
    toE164: stripWhatsAppPrefix(leadPhone),
    body,
  })

  await appendConversationMessage({
    conversationId: input.leadConversationId,
    direction:      "outbound",
    content:        body,
    externalMsgId:  sendRes.externalId ?? null,
  })

  if (sendRes.sent) {
    console.log(`[whatsapp.reengage] notified lead conv=${input.leadConversationId} property=${property.id}`)
  } else {
    console.error(`[whatsapp.reengage] send failed conv=${input.leadConversationId} err=${sendRes.error}`)
  }
}

function buildReEngagementMessage(p: {
  title:           string
  price:           number | null
  currency:        string | null
  listing_type:    string | null
  display_address: string | null
  slug:            string
}): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://www.easyrent.house")
  const url  = `${base}/es/p/${p.slug}`
  const priceLine = p.price != null
    ? `${p.currency === "CRC" ? "₡" : "$"}${Number(p.price).toLocaleString("es-CR")}${p.listing_type === "rent" ? "/mes" : ""}`
    : null
  return [
    "¡Buenas noticias! Te encontré una opción nueva que calza con lo que buscabas:",
    "",
    `*${p.title}*`,
    p.display_address ? p.display_address : null,
    priceLine ? `Precio: ${priceLine}` : null,
    "",
    url,
    "",
    "¿Querés que coordinemos una visita?",
  ].filter((l): l is string => l !== null).join("\n")
}
