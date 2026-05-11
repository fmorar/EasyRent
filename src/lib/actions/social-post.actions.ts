"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { formatListingPrice } from "@/lib/utils"
import { PROPERTY_TYPE_LABELS } from "@/lib/labels"
import type { ActionResult, PropertyType } from "@/types"

interface BuildResult {
  /** The full social-post text, ready to paste into Instagram / Facebook /
   *  WhatsApp. Plain text with emoji + line breaks. */
  text: string
  /** The same string broken into sections in case a UI wants to render
   *  them as separate copy-able pieces. */
  parts: {
    headline:    string
    description: string
    specs:       string
    price:       string
    location:    string
    contact:     string
    link:        string
    hashtags:    string
  }
}

/**
 * Build a "ready-to-paste" listing post for the given property, using
 * the CURRENT user's contact info. Works for owner and shared-with
 * agents alike — both can market the property under their own
 * identity. RLS gates which properties the caller can read.
 *
 * Output format (Spanish, voseo, follows the ux-writing skill):
 *
 *   🏠 Apartamento en alquiler en Escazú
 *   📍 San Rafael de Escazú · ubicación aproximada
 *
 *   Apartamento amueblado de 2 habitaciones con balcón privado,
 *   en condominio con seguridad 24/7 y piscina. […]
 *
 *   🛏 2 hab · 🛁 2 baños · 📐 95 m² · 🚗 1 parqueo
 *
 *   💰 USD 1,500/mes · cuota condominal incluida
 *
 *   📲 Consultá disponibilidad y agendá visita:
 *   👤 Sofía Vargas · Asesora inmobiliaria
 *   📱 +506 8888-8888 (WhatsApp)
 *   ✉️ sofia@example.com
 *   🌐 https://easyrent.cr/p/apartamento-escazu-2hab
 *
 *   #BienesRaicesCR #AlquilerEscazu #Inmobiliaria
 */
export async function getSocialPostContent(
  propertyId: string,
): Promise<ActionResult<BuildResult>> {
  const { profile } = await requireAuth()
  const supabase = await createClient()

  const { data: prop, error } = await supabase
    .from("properties")
    .select(`
      id, slug, title, description, property_type, listing_type,
      bedrooms, bathrooms, parking_spaces, area_sqm,
      price, currency, maintenance_fee, is_furnished,
      display_address, location_mode
    `)
    .eq("id", propertyId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error || !prop) {
    return { success: false, error: "No pudimos cargar la propiedad." }
  }

  // ── Headline ────────────────────────────────────────────────────
  const typeLabel = PROPERTY_TYPE_LABELS[prop.property_type as PropertyType] ?? "Propiedad"
  const opLabel   = prop.listing_type === "rent" ? "en alquiler" : "en venta"
  // Last segment of the address tends to be the canton/zone, the most
  // recognizable part for social posts.
  const lastZone  = prop.display_address
    ?.split(",").map((s) => s.trim()).filter(Boolean).slice(-2)[0]
  const headline  = `🏠 ${typeLabel} ${opLabel}${lastZone ? ` en ${lastZone}` : ""}`

  // ── Location ────────────────────────────────────────────────────
  const locParts: string[] = []
  if (prop.display_address) locParts.push(prop.display_address)
  if (prop.location_mode === "approximate") locParts.push("ubicación aproximada por privacidad")
  const location = locParts.length > 0 ? `📍 ${locParts.join(" · ")}` : ""

  // ── Description ─────────────────────────────────────────────────
  // Strip HTML, collapse whitespace, trim to ~280 chars so the post
  // fits comfortably on Instagram captions / WhatsApp.
  const plain = (prop.description ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
  const description = plain.length > 280 ? `${plain.slice(0, 277).trim()}…` : plain

  // ── Specs (bed/bath/area/parking) ───────────────────────────────
  const specBits: string[] = []
  if (prop.bedrooms != null)       specBits.push(`🛏 ${prop.bedrooms} ${prop.bedrooms === 1 ? "hab" : "hab"}`)
  if (prop.bathrooms != null)      specBits.push(`🛁 ${prop.bathrooms} ${prop.bathrooms === 1 ? "baño" : "baños"}`)
  if (prop.area_sqm != null)       specBits.push(`📐 ${prop.area_sqm} m²`)
  if (prop.parking_spaces != null) specBits.push(`🚗 ${prop.parking_spaces} ${prop.parking_spaces === 1 ? "parqueo" : "parqueos"}`)
  if (prop.is_furnished)           specBits.push("🪑 amueblado")
  const specs = specBits.join(" · ")

  // ── Price + maintenance ─────────────────────────────────────────
  let price = ""
  if (prop.price != null) {
    const formatted = formatListingPrice(
      Number(prop.price),
      prop.currency,
      prop.listing_type ?? null,
    )
    const tail = prop.maintenance_fee != null
      ? prop.listing_type === "rent"
        ? " · cuota condominal por confirmar"
        : ""
      : ""
    price = `💰 ${formatted}${tail}`
  }

  // ── Agent contact (the current user — NOT the property owner) ───
  const phoneLine = profile.phone
    ? `📱 ${profile.phone} (WhatsApp)`
    : ""
  const emailLine = profile.email
    ? `✉️ ${profile.email}`
    : ""
  const roleSuffix = profile.role === "owner_admin" ? "Agencia" : "Asesor inmobiliario"
  const contactLines = [
    "📲 Consultá disponibilidad y agendá visita:",
    `👤 ${profile.full_name} · ${roleSuffix}`,
    phoneLine,
    emailLine,
  ].filter(Boolean)
  const contact = contactLines.join("\n")

  // ── Public link ─────────────────────────────────────────────────
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    "https://easyrent.cr"
  const link = `🌐 ${normalizeBaseUrl(baseUrl)}/p/${prop.slug}`

  // ── Hashtags ────────────────────────────────────────────────────
  // Light, focused — too many hashtags reads as spam. Build from
  // intent + property type + zone.
  const tagBits: string[] = ["#BienesRaicesCR", "#CostaRica"]
  tagBits.push(prop.listing_type === "rent" ? "#Alquiler" : "#Venta")
  if (lastZone) {
    const zoneTag = "#" + lastZone.replace(/[^A-Za-z0-9áéíóúÁÉÍÓÚñÑüÜ]/g, "")
    if (zoneTag.length > 1) tagBits.push(zoneTag)
  }
  if (prop.property_type === "apartment") tagBits.push("#Apartamento")
  if (prop.property_type === "house")     tagBits.push("#Casa")
  const hashtags = tagBits.join(" ")

  // ── Assemble ────────────────────────────────────────────────────
  const blocks: string[] = []
  blocks.push([headline, location].filter(Boolean).join("\n"))
  if (description) blocks.push(description)
  if (specs)       blocks.push(specs)
  if (price)       blocks.push(price)
  blocks.push([contact, link].filter(Boolean).join("\n"))
  blocks.push(hashtags)

  const text = blocks.join("\n\n")

  return {
    success: true,
    data: {
      text,
      parts: {
        headline,
        description,
        specs,
        price,
        location,
        contact,
        link,
        hashtags,
      },
    },
  }
}

/** Trim trailing slash + ensure protocol — `vercel.app` URLs come without one. */
function normalizeBaseUrl(input: string): string {
  let u = input.trim().replace(/\/+$/, "")
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`
  return u
}
