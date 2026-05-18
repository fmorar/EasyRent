"use server"

import OpenAI from "openai"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth"
import { isAdminRole } from "@/lib/roles"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Database } from "@/types/supabase"

type LeadRow = Database["public"]["Tables"]["leads"]["Row"]

export interface SummaryResult {
  success:    boolean
  summary?:   string
  updatedAt?: string
  error?:     string
}

const MODEL              = "gpt-4o-mini"
const MAX_MESSAGES       = 30
const MAX_OUTPUT_TOKENS  = 220

const PROMPT = `Sos un asistente que escribe resúmenes ejecutivos de conversaciones de WhatsApp con leads inmobiliarios en Costa Rica.

Generá un resumen CORTO (3-5 viñetas, voseo neutral, sin saludos) que cubra:
- Qué busca el lead (operación, zona, tipo de propiedad, presupuesto si lo dijo)
- Qué le ofreció el bot (propiedades específicas si las hubo, por nombre)
- Datos personales / del gate de visita capturados (nombre, mascotas, parqueo, ocupación, etc.)
- Estado actual del thread (esperando respuesta, listo para visita, atascado, etc.)
- Próxima acción sugerida (1 línea)

NO inventés data. Si algo no se mencionó, NO lo escribas. Mantenelo factual y escaneable — el operador lee esto antes de tomar el thread.`

let openaiClient: OpenAI | null = null
function getClient(): OpenAI {
  if (openaiClient) return openaiClient
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY not set")
  openaiClient = new OpenAI({ apiKey })
  return openaiClient
}

/**
 * Generate (and persist) an AI summary of a WhatsApp thread.
 *
 *   • Auth: admin OR the agent currently assigned to the lead.
 *   • Reads the last 30 messages (both directions) so the model
 *     sees the bot's responses, the lead's audio transcripts, and
 *     any media-fallback chips.
 *   • Persists into `leads.extracted_data.thread_summary` alongside
 *     a `thread_summary_updated_at` ISO string. This is the SAME
 *     field the WhatsApp agent already reads as background context
 *     on long threads — so generating one here also feeds back into
 *     better agent behavior on the next turn.
 *   • Revalidates the conversation route so the UI refreshes.
 */
export async function generateThreadSummary(args: {
  conversationId: string
}): Promise<SummaryResult> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  // ── Authorization ────────────────────────────────────────────────
  const convRes = await supabase
    .from("conversations")
    .select("id, lead_id, lead:leads(id, assigned_to, extracted_data)")
    .eq("id", args.conversationId)
    .maybeSingle()
  if (convRes.error || !convRes.data) {
    return { success: false, error: "Conversación no encontrada." }
  }
  const data = convRes.data as {
    id:       string
    lead_id:  string | null
    lead:     Pick<LeadRow, "id" | "assigned_to" | "extracted_data"> | null
  }
  if (!data.lead_id || !data.lead) {
    return { success: false, error: "Conversación sin lead asociado." }
  }
  const isAdmin = isAdminRole(profile.role)
  if (!isAdmin && data.lead.assigned_to !== profile.id) {
    return { success: false, error: "No tenés permiso para regenerar el resumen." }
  }

  // ── Pull recent thread ──────────────────────────────────────────
  const msgsRes = await supabase
    .from("conversation_messages")
    .select("direction, content, created_at")
    .eq("conversation_id", args.conversationId)
    .order("created_at", { ascending: false })
    .limit(MAX_MESSAGES)
  const messages = ((msgsRes.data ?? []) as Array<{
    direction:  "inbound" | "outbound"
    content:    string
    created_at: string
  }>).reverse()

  if (messages.length === 0) {
    return { success: false, error: "Aún no hay mensajes para resumir." }
  }

  // ── Call OpenAI ──────────────────────────────────────────────────
  const transcript = messages
    .map((m) => `${m.direction === "inbound" ? "Lead" : "Bot"}: ${m.content}`)
    .join("\n")

  let summary: string
  try {
    const client = getClient()
    const resp = await client.responses.create({
      model:             MODEL,
      instructions:      PROMPT,
      input:             transcript,
      max_output_tokens: MAX_OUTPUT_TOKENS,
    })
    summary = (resp.output_text ?? "").trim()
    if (!summary) {
      return { success: false, error: "El modelo devolvió un resumen vacío. Probá de nuevo." }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[thread-summary] OpenAI failed", msg)
    return { success: false, error: "No se pudo generar el resumen." }
  }

  // ── Persist into extracted_data JSONB ────────────────────────────
  const updatedAt = new Date().toISOString()
  const admin     = createAdminClient()
  const merged    = {
    ...((data.lead.extracted_data ?? {}) as Record<string, unknown>),
    thread_summary:            summary,
    thread_summary_updated_at: updatedAt,
  } as Database["public"]["Tables"]["leads"]["Update"]["extracted_data"]

  const upd = await admin
    .from("leads")
    .update({ extracted_data: merged })
    .eq("id", data.lead.id)
  if (upd.error) {
    console.error("[thread-summary] persist failed", upd.error.message)
    return { success: false, error: "Se generó el resumen pero no se pudo guardar." }
  }

  revalidatePath(`/conversations/${args.conversationId}`)
  return { success: true, summary, updatedAt }
}
