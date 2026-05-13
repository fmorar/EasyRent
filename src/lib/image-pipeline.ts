// Normalises an image File before it hits Supabase Storage:
//
//   1. HEIC/HEIF → JPEG (so non-Safari can render it)
//   2. Resize down to a sane max dimension (iPhone 4K is overkill
//      for a property listing — kills file size, no visible loss)
//   3. Re-encode JPEG with quality 0.85 (visually indistinguishable
//      from the original at this size)
//   4. Strip EXIF metadata (privacy: drops GPS coords, camera serial,
//      timestamps — none of which the listing surface uses, and all
//      of which we'd rather not store)
//
// Browsers do steps 2-4 in a Web Worker so the UI stays responsive
// even for 20+ MB iPhone photos.

import imageCompression from "browser-image-compression"
import { convertHeicToJpegIfNeeded } from "@/lib/heic-to-jpeg"

/**
 * Target ceiling for the compressed output. The library tries to hit
 * this; original photos under it pass through with light re-encoding.
 */
const MAX_SIZE_MB = 2

/**
 * Cap longest side at 2400px. Retina displays at 1.5× scale top out
 * around 2200 wide, so we have headroom for the gallery's hero crop
 * without storing 4032×3024 iPhone originals (~5 MB) just to scale
 * them down on every render.
 */
const MAX_DIMENSION = 2400

/**
 * Files smaller than this are passed through after HEIC conversion
 * without re-encoding. Below ~300 KB compression saves so little it's
 * not worth the worker spin-up cost.
 */
const SKIP_COMPRESSION_UNDER_BYTES = 300 * 1024

export async function prepareImageForUpload(file: File): Promise<File> {
  // Step 1: HEIC → JPEG. Pass-through if not HEIC.
  const normalised = await convertHeicToJpegIfNeeded(file)

  // Step 2-4: skip for tiny files (compression overhead > savings).
  if (normalised.size < SKIP_COMPRESSION_UNDER_BYTES) {
    return normalised
  }

  // SVGs are vector — compressing rasterises them and ruins quality.
  // Pass through; the storage cost is negligible.
  if (normalised.type === "image/svg+xml") {
    return normalised
  }

  try {
    const compressed = await imageCompression(normalised, {
      maxSizeMB:          MAX_SIZE_MB,
      maxWidthOrHeight:   MAX_DIMENSION,
      useWebWorker:       true,
      initialQuality:     0.85,
      // EXIF is stripped by default; we re-affirm here so a future
      // library upgrade can't flip the default on us. GPS coords +
      // camera serials are exactly the metadata we don't want stored
      // alongside listing photos.
      preserveExif:       false,
      // Output type follows the input. PNG stays PNG (alpha matters);
      // anything else becomes JPEG for smallest payload.
      fileType:           normalised.type === "image/png" ? "image/png" : "image/jpeg",
    })

    return compressed
  } catch (err) {
    // Don't block the upload on compression failure — better to store
    // the original (large) file than to fail silently on the agent.
    console.error("[image-pipeline] compression failed, uploading original:", err)
    return normalised
  }
}
