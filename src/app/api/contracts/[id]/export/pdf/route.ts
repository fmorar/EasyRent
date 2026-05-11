// POST /api/contracts/:id/export/pdf
// Generates a PDF from the contract's editor HTML, uploads it to
// the `rental-contracts` storage bucket, records a
// `contract_exports` row, and returns a signed URL for download.

import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import {
  htmlToPdfBuffer, buildFilename,
} from "@/lib/contracts/contract-export-service"
import { generateContractDraft } from "@/lib/contracts/contract-generation-service"
import { ContractDataSchema } from "@/types/contracts"

export const runtime = "nodejs"
export const maxDuration = 60

interface Params { params: Promise<{ id: string }> }

const SIGNED_URL_TTL = 60 * 60   // 1 hour

export async function POST(_req: Request, { params }: Params) {
  const { profile } = await requireAuth()
  const { id }      = await params
  const supabase    = await createClient()

  const { data: c } = await supabase
    .from("contracts")
    .select(`
      id, title, editor_content_html, contract_data,
      property:properties(slug),
      lead:leads(full_name),
      template:contract_templates(template_content)
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 })

  // Fall back to a freshly-generated draft when the editor HTML is
  // empty (happens when the template was re-seeded and the cached
  // `editor_content_html` was busted, or when the user is exporting
  // a brand-new contract before opening it in the editor).
  let html = c.editor_content_html
  if (!html || html.trim().length === 0) {
    type TplJoin = { template?: { template_content?: string | null } | null }
    const tplContent = (c as unknown as TplJoin).template?.template_content
    if (!tplContent) {
      return NextResponse.json(
        { error: "No se puede exportar: la plantilla no está configurada." },
        { status: 400 },
      )
    }
    const dataParsed = ContractDataSchema.safeParse(c.contract_data)
    if (!dataParsed.success) {
      return NextResponse.json(
        { error: "No se puede exportar: los datos del contrato son inválidos." },
        { status: 400 },
      )
    }
    const generated = generateContractDraft({
      template_html: tplContent,
      contract_data: dataParsed.data,
    })
    html = generated.html

    // Persist the freshly generated HTML so future exports skip the
    // regen and the editor tab shows the same content.
    await supabase
      .from("contracts")
      .update({
        editor_content_html:  html,
        generated_plain_text: generated.plain_text,
      } as never)
      .eq("id", id)
  }

  // Render PDF
  const buffer = await htmlToPdfBuffer(html, {
    title: c.title ?? "Contrato de alquiler",
  })

  // Compose storage path: <contractId>/<filename>
  type Joined = { property: { slug: string } | null; lead: { full_name: string } | null }
  const j = c as unknown as typeof c & Joined
  const filename = buildFilename({
    contractId:     id,
    propertySlug:   j.property?.slug,
    tenantFullName: j.lead?.full_name,
    ext:            "pdf",
  })
  const storagePath = `${id}/${filename}`

  // Upload (upsert so re-exports overwrite the previous file).
  const { error: uploadErr } = await supabase
    .storage
    .from("rental-contracts")
    .upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: true,
    })
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 })
  }

  // Record the export + update the contract's pdf_path pointer.
  await Promise.all([
    supabase.from("contract_exports").insert({
      contract_id:  id,
      export_type:  "pdf",
      file_path:    storagePath,
      file_name:    filename,
      generated_by: profile.id,
    }),
    supabase.from("contracts")
      .update({ pdf_path: storagePath } as never)
      .eq("id", id),
    supabase.from("contract_events").insert({
      contract_id: id,
      event_type:  "exported_pdf",
      message:     `PDF generado: ${filename}`,
      metadata:    { storage_path: storagePath } as never,
      created_by:  profile.id,
    }),
  ])

  // Return a short-lived signed URL.
  const { data: signed } = await supabase
    .storage
    .from("rental-contracts")
    .createSignedUrl(storagePath, SIGNED_URL_TTL, {
      download: filename,
    })

  return NextResponse.json({
    storage_path: storagePath,
    file_name:    filename,
    download_url: signed?.signedUrl ?? null,
  })
}
