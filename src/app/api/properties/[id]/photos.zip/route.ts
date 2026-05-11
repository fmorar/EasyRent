// ============================================================
// GET /api/properties/[id]/photos.zip
//
// Streams every photo associated with a property — both the
// property's own photos AND the inherited project photos when
// the property belongs to a project — bundled as a single ZIP.
//
// Auth: relies on the `properties` RLS policy. The route reads
// the row through the regular auth-aware client; if the caller
// can't see the property (not owner, not shared with, not admin),
// the read returns nothing and we 404.
//
// Naming inside the ZIP:
//   property/01-cover.jpg
//   property/02-...
//   project/01-...
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

  // Auth gate — the RLS on `properties` enforces who can see this row.
  // We select the slug + project_id; if zero rows come back, the user
  // can't see the property and we return 404 (not 403 — don't leak that
  // it exists).
  const { data: prop, error: propErr } = await supabase
    .from("properties")
    .select("id, slug, title, project_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle() as {
      data: { id: string; slug: string; title: string; project_id: string | null } | null
      error: unknown
    }

  if (propErr || !prop) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Property's own photos
  const { data: propPhotos } = await supabase
    .from("property_photos")
    .select("url, caption, is_cover, order_index")
    .eq("property_id", id)
    .order("order_index") as { data: PhotoRow[] | null }

  // Inherited project photos (when the property belongs to a project)
  const { data: projectPhotos } = prop.project_id
    ? await supabase
        .from("project_photos")
        .select("url, caption, is_cover, order_index")
        .eq("project_id", prop.project_id)
        .order("order_index") as { data: PhotoRow[] | null }
    : { data: null }

  const totalPhotos = (propPhotos?.length ?? 0) + (projectPhotos?.length ?? 0)
  if (totalPhotos === 0) {
    return NextResponse.json({ error: "No photos to download" }, { status: 404 })
  }

  // Hoist the cover photo to the start so consumers can grab the
  // first file as the canonical hero without sorting.
  const sortedProp = sortWithCoverFirst(propPhotos ?? [])
  const sortedProj = sortWithCoverFirst(projectPhotos ?? [])

  const zip = new JSZip()
  const propFolder = zip.folder("property")
  const projFolder = sortedProj.length > 0 ? zip.folder("project") : null

  // Fetch all images in parallel — much faster than serial when you
  // have 10-20 photos. We catch per-image failures so one broken URL
  // doesn't kill the whole download.
  const propResults = await Promise.allSettled(
    sortedProp.map((p, i) => fetchImage(p, i)),
  )
  const projResults = await Promise.allSettled(
    sortedProj.map((p, i) => fetchImage(p, i)),
  )

  let added = 0
  for (const r of propResults) {
    if (r.status !== "fulfilled" || !r.value) continue
    propFolder?.file(r.value.name, r.value.bytes)
    added++
  }
  if (projFolder) {
    for (const r of projResults) {
      if (r.status !== "fulfilled" || !r.value) continue
      projFolder.file(r.value.name, r.value.bytes)
      added++
    }
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
    // Lossy/JPEG content compresses poorly, so use a low effort level
    // — we save build time without much size penalty.
    compressionOptions: { level: 1 },
  })

  const filename = `${slugify(prop.title || prop.slug || "fotos")}-fotos.zip`

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
  // Prefer the URL extension when it's a real image extension; fall
  // back to the Content-Type, then default to jpg.
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
