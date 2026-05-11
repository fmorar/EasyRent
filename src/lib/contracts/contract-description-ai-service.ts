// ============================================================
// AI-generated property description for the contract's PRIMERA
// clause ("OBJETO DEL CONTRATO"). Takes the structured property
// facts and produces a short, formal Spanish paragraph suitable
// to drop into the contract body.
//
// We don't pass the full contract data — only the property facts.
// The output is plain prose (no HTML tags) because the contract
// template wraps `{{property.description}}` inside an existing
// `<p>` element.
//
// The model produces a SINGLE paragraph (~80-140 words) — short
// enough that the agent can read it before publishing, long enough
// to cover all the standard "incluye…" phrasing that real CR leases
// contain (mobiliario, acabados, almacenamiento, grifería, etc.).
// ============================================================

import OpenAI from "openai"

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface DescribeInput {
  property_type:    string | null   // raw enum from properties.property_type
  bedrooms:         number          // contract_data.property.bedrooms
  bathrooms:        number
  parking_spaces:   number
  area_sqm:         number | null
  is_furnished:     boolean | null
  amenities:        string[]         // free-form, building or unit
  condominium_name: string
  /** Optional existing description to inform the rewrite (when the
   *  agent already typed something but wants to upgrade the prose). */
  current_description?: string
}

const TYPE_ES: Record<string, string> = {
  apartment:  "apartamento",
  house:      "casa",
  land:       "terreno",
  commercial: "local comercial",
  office:     "oficina",
  warehouse:  "bodega",
}

export async function describeProperty(input: DescribeInput): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    // Without OpenAI configured, return a deterministic fallback.
    return fallbackDescription(input)
  }

  const facts = buildFactsBlock(input)

  const completion = await client.chat.completions.create({
    model:       "gpt-4o-mini",
    temperature: 0.4,
    max_tokens:  450,
    messages: [
      {
        role:    "system",
        content: SYSTEM_PROMPT,
      },
      {
        role:    "user",
        content: `Datos de la unidad:\n${facts}\n\nGenerá la descripción.`,
      },
    ],
  })

  const text = completion.choices[0]?.message?.content?.trim() ?? ""
  return text || fallbackDescription(input)
}

const SYSTEM_PROMPT = `
Sos un redactor legal especializado en contratos de arrendamiento residencial en Costa Rica.

Tu tarea: redactar UN SOLO PÁRRAFO (no listas, no encabezados, no markdown) en español
formal que describa el inmueble objeto del contrato. Será insertado dentro de la cláusula
PRIMERA ("OBJETO DEL CONTRATO") de un contrato real.

Reglas estrictas:
- Voseo Costa Rica: usá "vos / tenés / podés" si necesitás verbos en segunda persona.
  Pero el párrafo describe el inmueble en tercera persona, así que pocas veces aplicará.
- Formato: prosa continua, una oración o dos, entre 60 y 140 palabras.
- NO incluyas HTML, NO uses guiones largos (—), NO uses comillas decorativas.
- Empezá con "incluye" o describí directamente, sin frases tipo "Este apartamento es…".
- Mencioná: el mobiliario, los acabados, los espacios de almacenamiento (clósets,
  alacenas), grifería, ventilación/cortineros si aplica, y cualquier amenidad que
  sea claramente del INTERIOR de la unidad (no áreas comunes del condominio).
- NO inventes detalles que no estén en los datos. Si no hay amenidades de interior
  específicas, escribí algo genérico verificable: "cumple con las condiciones de
  habitabilidad y normativas vigentes". Mejor poco y verdadero que mucho e inventado.
- NO menciones precio, fechas, partes ni el nombre del condominio (eso ya está en
  otras partes del contrato).
- Cerrá con: "Para efectos de verificación y control, las partes acuerdan que el
  detalle del mobiliario forma parte integral del inmueble arrendado y deberá ser
  conservado en el mismo estado en que fue entregado, salvo el desgaste normal
  derivado del uso y del transcurso del tiempo." (literal — copiá esa oración tal cual al final)

Devuelvé únicamente el párrafo. Sin prefacio, sin firma, sin nota.
`.trim()

function buildFactsBlock(input: DescribeInput): string {
  const t = input.property_type ? (TYPE_ES[input.property_type] ?? input.property_type) : "inmueble"
  const lines = [
    `- tipo: ${t}`,
    `- habitaciones: ${input.bedrooms}`,
    `- baños: ${input.bathrooms}`,
    `- parqueos: ${input.parking_spaces}`,
    input.area_sqm != null ? `- área: ${input.area_sqm} m²` : null,
    `- amueblado: ${input.is_furnished ? "sí" : "no"}`,
    input.amenities.length > 0
      ? `- amenidades / elementos:\n  • ${input.amenities.join("\n  • ")}`
      : "- amenidades / elementos: ninguna registrada",
    input.current_description?.trim()
      ? `\nDescripción existente para reescribir (mejorá redacción, no inventes):\n"${input.current_description.trim()}"`
      : null,
  ].filter(Boolean)
  return lines.join("\n")
}

/** Used when OpenAI is unavailable. Composes a deterministic minimal
 *  description from the structured facts. */
function fallbackDescription(input: DescribeInput): string {
  const t  = input.property_type ? (TYPE_ES[input.property_type] ?? "inmueble") : "inmueble"
  const am = input.amenities.length > 0
    ? ` Cuenta con ${input.amenities.slice(0, 6).join(", ")}.`
    : ""
  const furnished = input.is_furnished
    ? " El inmueble se entrega amueblado, conforme al inventario adjunto."
    : ""
  return [
    `${capitalize(t)} de ${input.bedrooms} habitaciones, ${input.bathrooms} baños y ${input.parking_spaces} parqueos`,
    input.area_sqm != null ? ` con ${input.area_sqm} m² de área habitable.` : ".",
    am,
    furnished,
    " Cumple con las condiciones de habitabilidad y las normativas técnicas vigentes.",
    " Para efectos de verificación y control, las partes acuerdan que el detalle del mobiliario forma parte integral del inmueble arrendado y deberá ser conservado en el mismo estado en que fue entregado, salvo el desgaste normal derivado del uso y del transcurso del tiempo.",
  ].join("")
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1)
}
