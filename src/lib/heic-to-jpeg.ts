// HEIC/HEIF → JPEG conversion for photo uploads.
//
// iPhones default to HEIC. Two issues if we upload them as-is:
//
//   1. iOS Safari often reports `File.type` as an empty string (or
//      "application/octet-stream") for HEIC, so a naive
//      f.type.startsWith("image/") validator rejects them.
//
//   2. Even when storage accepts the file, every non-Apple browser
//      fails to render HEIC. Cover photos and gallery thumbnails
//      look broken for visitors on Chrome/Firefox/Android.
//
// Normalising at upload time (browser-side, before Supabase Storage
// sees it) gives us a universally-renderable JPEG. heic-to is ESM,
// ~200KB compressed, and uses libheif compiled to WASM.

import { heicTo, isHeic } from "heic-to"

const HEIC_EXTENSIONS = [".heic", ".heif"] as const

/**
 * True when the file looks like HEIC/HEIF — by MIME type when iOS
 * provides one, falling back to filename extension when it doesn't.
 */
export function looksLikeHeic(file: File): boolean {
  const type = file.type.toLowerCase()
  if (type === "image/heic" || type === "image/heif") return true
  const name = file.name.toLowerCase()
  return HEIC_EXTENSIONS.some((ext) => name.endsWith(ext))
}

/**
 * Convert a HEIC/HEIF File to a JPEG File. Pass-through for anything
 * that isn't HEIC. The returned File has a `.jpg` name and
 * `image/jpeg` MIME so the rest of the upload pipeline can treat it
 * like a normal image.
 *
 * Throws if conversion fails — callers should surface a toast like
 * "No se pudo procesar esta imagen, probá con JPG o PNG."
 */
export async function convertHeicToJpegIfNeeded(file: File): Promise<File> {
  if (!looksLikeHeic(file)) return file

  // Extra safety: heic-to's own sniffer (reads the file's magic bytes)
  // catches the rare case of a .heic-named file that's actually JPEG.
  const reallyHeic = await isHeic(file)
  if (!reallyHeic) return file

  const blob = await heicTo({ blob: file, type: "image/jpeg", quality: 0.9 })
  const newName = file.name.replace(/\.(heic|heif)$/i, ".jpg")
  return new File([blob], newName, {
    type:         "image/jpeg",
    lastModified: file.lastModified,
  })
}
