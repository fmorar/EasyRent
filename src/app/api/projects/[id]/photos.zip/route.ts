// ============================================================
// GET /api/projects/[id]/photos.zip
//
// Streams every photo associated with a project as a single ZIP.
// Auth: relies on the `projects` RLS policy. The route reads the
// row through the regular auth-aware client; if the caller can't
// see the project, the read returns nothing and we 404 (not 403 —
// don't leak that it exists).
//
// Naming inside the ZIP:
//   01-cover-<caption>.jpg
//   02-<caption>.jpg
//   …
//
// Runtime: Node (we use jszip + node:fetch for binary blobs).
// ============================================================

import { NextResponse } from "next/server"
import JSZip from "jszip"
import { createClient } from "@/lib/supabase/server"
import { slugify } from "@/lib/utils"

export const runtime     = "nodejs"
export const maxDuration = 60

interface Params { params: Promise<{ id: string }> }

interface PhotoRow {
  url:         string
  caption:     string | null
  is_cover:    boolean
  order_index: number
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  // Auth gate — RLS on `projects` decides who can see this row.
  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .select("id, slug, title")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle() as {
      data: { id: string; slug: string; title: string } | null
      error: unknown
    }

  if (projectErr || !project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { data: photos } = await supabase
    .from("project_photos")
    .select("url, caption, is_cover, order_index")
    .eq("project_id", id)
    .order("order_index") as { data: PhotoRow[] | null }

  if (!photos?.length) {
    return NextResponse.json({ error: "No photos to download" }, { status: 404 })
  }

  // Hoist the cover photo to the start so consumers can grab the
  // first file as the canonical hero without sorting.
  const sorted = sortWithCoverFirst(photos)

  const zip = new JSZip()

  // Fetch all images in parallel — much faster than serial. Per-image
  // failures are tolerated so one broken URL doesn't kill the whole
  // download.
  const results = await Promise.allSettled(
    sorted.map((p, i) => fetchImage(p, i)),
  )

  let added = 0
  for (const r of results) {
    if (r.status !== "fulfilled" || !r.value) continue
    zip.file(r.value.name, r.value.bytes)
    added++
  }

  if (added === 0) {
    return NextResponse.json(
      { error: "Could not download any of the photos." },
      { status: 502 },
    )
  }

  const buffer = await zip.generateAsync({
    type:        "nodebuffer",
    compression: "DEFLATE",
    // Lossy/JPEG content compresses poorly; keep effort low to save
    // build time without much size penalty.
    compressionOptions: { level: 1 },
  })

  const filename = `${slugify(project.title || project.slug || "fotos")}-fotos.zip`

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type":        "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length":      String(buffer.length),
      "Cache-Control":       "private, no-store",
    },
  })
}

// ── Helpers ──────────────────────────────────────────────────────

function sortWithCoverFirst(photos: PhotoRow[]): PhotoRow[] {
  const sorted = [...photos].sort((a, b) => a.order_index - b.order_index)
  const coverIdx = sorted.findIndex((p) => p.is_cover)
  if (coverIdx <= 0) return sorted
  return [sorted[coverIdx], ...sorted.slice(0, coverIdx), ...sorted.slice(coverIdx + 1)]
}

async function fetchImage(
  p: PhotoRow, index: number,
): Promise<{ name: string; bytes: ArrayBuffer } | null> {
  try {
    const res = await fetch(p.url, { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) return null
    const bytes = await res.arrayBuffer()
    const ext = guessExt(p.url, res.headers.get("content-type"))
    const num = String(index + 1).padStart(2, "0")
    const captionSlug = p.caption ? `-${slugify(p.caption).slice(0, 40)}` : ""
    const coverSlug   = p.is_cover && index === 0 ? "-cover" : ""
    return {
      name:  `${num}${coverSlug}${captionSlug}.${ext}`,
      bytes,
    }
  } catch {
    return null
  }
}

function guessExt(url: string, contentType: string | null): string {
  const m = /\.(jpe?g|png|webp|avif|gif|heic)(?:\?|$)/i.exec(url)
  if (m) return m[1].toLowerCase().replace("jpeg", "jpg")
  if (contentType) {
    const ct = contentType.split(";")[0].trim().toLowerCase()
    if (ct === "image/jpeg") return "jpg"
    if (ct === "image/png")  return "png"
    if (ct === "image/webp") return "webp"
    if (ct === "image/avif") return "avif"
    if (ct === "image/gif")  return "gif"
    if (ct === "image/heic") return "heic"
  }
  return "jpg"
}
