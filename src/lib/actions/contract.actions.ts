"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import {
  ContractDataSchema,
  type ContractData,
} from "@/types/contracts"
import type { ActionResult, Contract, ContractStatus } from "@/types"
import { prefillContractData } from "@/lib/contracts/contract-data-prefill-service"
import { generateContractDraft } from "@/lib/contracts/contract-generation-service"

// ── createContract ──────────────────────────────────────────────
//
// Step 1 of the wizard: the user picks property + lead, system
// prefills, system generates the first draft, persists row +
// version, returns the new contract id.

interface CreateInput {
  property_id: string
  lead_id:     string | null
  /** Override the property's owner_id (rare — when the agent
   *  corrects the auto-detected owner). */
  owner_id?:   string | null
  /** Override the default rental template. Defaults to whichever
   *  contract_template row has `is_default=true AND contract_type='rental'`. */
  template_id?: string | null
}

export async function createContract(
  input: CreateInput,
): Promise<ActionResult<{ id: string }>> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  // 1. Resolve template (default rental for CR/es when omitted).
  const templateId = input.template_id ?? await resolveDefaultTemplateId(supabase)
  if (!templateId) {
    return { success: false, error: "No hay plantilla de alquiler configurada." }
  }
  const { data: template } = await supabase
    .from("contract_templates")
    .select("id, template_content, name")
    .eq("id", templateId)
    .is("deleted_at", null)
    .maybeSingle()
  if (!template?.template_content) {
    return { success: false, error: "La plantilla seleccionada no tiene contenido." }
  }

  // 2. Prefill contract_data from property + owner + lead + prior contract.
  const prefilled = await prefillContractData({
    supabase,
    property_id: input.property_id,
    lead_id:     input.lead_id,
    owner_id:    input.owner_id ?? null,
  })

  // 3. Generate the first draft (HTML + plain text + warnings).
  const generated = generateContractDraft({
    template_html: template.template_content,
    contract_data: prefilled.contract_data,
  })

  // 4. Persist the contract row.
  const title = prefilled.contract_data.contract.title ||
                `Contrato de alquiler — ${prefilled.contract_data.property.title || "Borrador"}`

  const { data: row, error: insertErr } = await supabase
    .from("contracts")
    .insert({
      contract_type:        "rental",
      template_id:          templateId,
      property_id:          input.property_id,
      owner_id:             input.owner_id ?? null,
      lead_id:              input.lead_id,
      created_by:           profile.id,
      status:               "draft" satisfies ContractStatus,
      title,
      language:             "es",
      country:              "CR",
      contract_data:        generated.json as never,
      editor_content_html:  generated.html,
      generated_plain_text: generated.plain_text,
    })
    .select("id")
    .single()

  if (insertErr || !row) {
    return { success: false, error: insertErr?.message ?? "No se pudo crear el contrato." }
  }

  // 5. First version + audit event.
  await Promise.all([
    supabase.from("contract_versions").insert({
      contract_id:         row.id,
      version_number:      1,
      contract_data:       generated.json as never,
      editor_content_html: generated.html,
      change_summary:      "Borrador inicial generado desde la plantilla.",
      created_by:          profile.id,
    }),
    logEvent(row.id, profile.id, "draft_generated", "Borrador inicial generado.", {
      template_id: templateId,
      missing_fields_count: generated.missing_fields.length,
      warnings_count: generated.warnings.length,
    }),
  ])

  revalidatePath("/contracts")
  return { success: true, data: { id: row.id } }
}

// ── updateContractData / updateEditorContent ────────────────────

interface PatchInput {
  id:                  string
  contract_data?:      ContractData
  editor_content_html?: string
  editor_content_json?: unknown
  /** When `regenerate=true`, the editor HTML is rebuilt from
   *  `contract_data`. Implies the user pressed "regenerate from
   *  structured data" — the API route should warn before. */
  regenerate?:         boolean
}

export async function updateContract(
  input: PatchInput,
): Promise<ActionResult<{ warnings_count: number; missing_count: number }>> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  const { data: existing } = await supabase
    .from("contracts")
    .select("id, template_id, status, contract_data, editor_content_html")
    .eq("id", input.id)
    .is("deleted_at", null)
    .maybeSingle()
  if (!existing) return { success: false, error: "Contrato no encontrado." }

  const finalized = existing.status === "finalized" ||
                    existing.status === "signed"
  if (finalized) {
    return { success: false, error: "No se puede editar un contrato finalizado o firmado." }
  }

  // Validate the structured data when present (strips unknowns,
  // applies defaults, throws on type mismatch).
  let newData: ContractData | null = null
  if (input.contract_data) {
    const parsed = ContractDataSchema.safeParse(input.contract_data)
    if (!parsed.success) {
      return { success: false, error: "Datos del contrato inválidos." }
    }
    newData = parsed.data
  }

  // When `regenerate=true`, also rebuild the HTML.
  let newHtml = input.editor_content_html ?? existing.editor_content_html
  let newPlain: string | undefined
  let warningsCount = 0
  let missingCount  = 0

  if (input.regenerate && newData) {
    const { data: tpl } = await supabase
      .from("contract_templates")
      .select("template_content")
      .eq("id", existing.template_id!)
      .maybeSingle()
    if (!tpl?.template_content) {
      return { success: false, error: "Plantilla no encontrada." }
    }
    const generated = generateContractDraft({
      template_html: tpl.template_content,
      contract_data: newData,
    })
    newHtml       = generated.html
    newPlain      = generated.plain_text
    warningsCount = generated.warnings.length
    missingCount  = generated.missing_fields.length
  }

  const update: Record<string, unknown> = {}
  if (newData)                         update.contract_data        = newData
  if (newHtml !== undefined)           update.editor_content_html  = newHtml
  if (input.editor_content_json)       update.editor_content_json  = input.editor_content_json
  if (newPlain !== undefined)          update.generated_plain_text = newPlain

  const { error } = await supabase
    .from("contracts")
    .update(update as never)
    .eq("id", input.id)
  if (error) return { success: false, error: error.message }

  await logEvent(input.id, profile.id,
    input.regenerate ? "regenerated" : "draft_saved",
    input.regenerate ? "Borrador regenerado desde los datos estructurados." : "Borrador guardado.",
    { warnings_count: warningsCount, missing_count: missingCount },
  )

  revalidatePath(`/contracts/${input.id}`)
  return { success: true, data: { warnings_count: warningsCount, missing_count: missingCount } }
}

// ── saveVersion — snapshot the current state ────────────────────

export async function saveContractVersion(
  contractId: string,
  changeSummary?: string,
): Promise<ActionResult<{ version_number: number }>> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  const { data: c } = await supabase
    .from("contracts")
    .select("id, contract_data, editor_content_html, editor_content_json")
    .eq("id", contractId)
    .is("deleted_at", null)
    .maybeSingle()
  if (!c) return { success: false, error: "Contrato no encontrado." }

  const { data: latest } = await supabase
    .from("contract_versions")
    .select("version_number")
    .eq("contract_id", contractId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle()
  const next = (latest?.version_number ?? 0) + 1

  const { error } = await supabase
    .from("contract_versions")
    .insert({
      contract_id:         contractId,
      version_number:      next,
      contract_data:       c.contract_data,
      editor_content_html: c.editor_content_html,
      editor_content_json: c.editor_content_json,
      change_summary:      changeSummary ?? null,
      created_by:          profile.id,
    })
  if (error) return { success: false, error: error.message }

  await logEvent(contractId, profile.id, "version_saved",
    `Versión ${next} guardada.`, { version_number: next })

  revalidatePath(`/contracts/${contractId}`)
  return { success: true, data: { version_number: next } }
}

// ── finalize — gate via validation, then transition status ──────

export async function finalizeContract(
  contractId: string,
): Promise<ActionResult<Contract>> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  const { data: c } = await supabase
    .from("contracts")
    .select("id, template_id, contract_data, editor_content_html")
    .eq("id", contractId)
    .is("deleted_at", null)
    .maybeSingle()
  if (!c) return { success: false, error: "Contrato no encontrado." }

  const parsed = ContractDataSchema.safeParse(c.contract_data)
  if (!parsed.success) {
    return { success: false, error: "Datos del contrato inválidos." }
  }

  const { data: tpl } = await supabase
    .from("contract_templates")
    .select("template_content")
    .eq("id", c.template_id!)
    .maybeSingle()
  if (!tpl?.template_content) {
    return { success: false, error: "Plantilla no encontrada." }
  }

  const generated = generateContractDraft({
    template_html: tpl.template_content,
    contract_data: parsed.data,
  })
  if (generated.missing_fields.length > 0) {
    return {
      success: false,
      error: `Faltan ${generated.missing_fields.length} campos requeridos antes de finalizar.`,
    }
  }
  // Health-check warnings of severity high are also blockers.
  const blockers = generated.warnings.filter((w) => w.severity === "high")
  if (blockers.length > 0) {
    return {
      success: false,
      error: `El contrato tiene ${blockers.length} alerta(s) críticas. Resolvelas antes de finalizar.`,
    }
  }

  const { data: updated, error } = await supabase
    .from("contracts")
    .update({
      status:        "finalized" satisfies ContractStatus,
      finalized_at:  new Date().toISOString(),
    } as never)
    .eq("id", contractId)
    .select("*")
    .single()
  if (error || !updated) return { success: false, error: error?.message ?? "Error al finalizar." }

  await logEvent(contractId, profile.id, "finalized",
    "Contrato finalizado y listo para descarga.", {})

  revalidatePath(`/contracts/${contractId}`)
  return { success: true, data: updated as Contract }
}

// ── archive (soft-delete) ───────────────────────────────────────

export async function archiveContract(
  contractId: string,
): Promise<ActionResult> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  const { error } = await supabase
    .from("contracts")
    .update({ status: "archived" satisfies ContractStatus } as never)
    .eq("id", contractId)
  if (error) return { success: false, error: error.message }

  await logEvent(contractId, profile.id, "archived", "Contrato archivado.", {})
  revalidatePath("/contracts")
  return { success: true, data: undefined }
}

// ── helpers ─────────────────────────────────────────────────────

async function resolveDefaultTemplateId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase
    .from("contract_templates")
    .select("id")
    .eq("contract_type", "rental")
    .eq("country", "CR")
    .eq("language", "es")
    .eq("is_default", true)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle()
  return data?.id ?? null
}

async function logEvent(
  contractId: string,
  userId:     string | null,
  type:       string,
  message:    string,
  metadata:   Record<string, unknown>,
) {
  const supabase = await createClient()
  await supabase.from("contract_events").insert({
    contract_id: contractId,
    event_type:  type,
    message,
    metadata:    metadata as never,
    created_by:  userId,
  })
}
