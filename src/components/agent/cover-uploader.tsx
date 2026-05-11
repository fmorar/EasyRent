"use client"

import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { CameraIcon, TrashIcon, PhotoIcon } from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { updateProfileCover } from "@/lib/actions/auth.actions"
import { cn } from "@/lib/utils"

interface Props {
  /** Current authenticated user id — used as the storage folder so
   *  RLS lets the user upload + overwrite + delete their own cover. */
  userId:   string
  /** Existing cover URL (or null when never set). */
  coverUrl: string | null
}

/** 5 MB — matches the bucket's `file_size_limit`. */
const MAX_BYTES = 5 * 1024 * 1024

/**
 * Cover-photo upload control for `/settings`. Mirrors the avatar
 * uploader's flow but renders a wide landscape preview (16:5 aspect)
 * so the user sees roughly what their banner will look like on the
 * public profile.
 *
 * Storage: same `avatars` bucket as the profile photo, under
 * `${userId}/cover.{ext}`. The bucket RLS scopes by folder so no new
 * policy is needed.
 */
export function CoverUploader({ userId, coverUrl }: Props) {
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const [preview, setPreview]        = useState<string | null>(coverUrl)
  const [isPending, startTransition] = useTransition()

  function pickFile() {
    inputRef.current?.click()
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      toast.error("Subí una imagen JPG, PNG o WebP.")
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error("La imagen pesa más de 5 MB. Probá con una más liviana.")
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setPreview(previewUrl)

    const ext  = (file.type.split("/")[1] || "jpg").toLowerCase()
    const path = `${userId}/cover.${ext}`

    startTransition(async () => {
      try {
        const { error: uploadErr } = await supabase.storage
          .from("avatars")
          .upload(path, file, {
            upsert:        true,
            cacheControl:  "3600",
            contentType:   file.type,
          })
        if (uploadErr) throw new Error(uploadErr.message)

        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(path)
        const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`

        const result = await updateProfileCover(publicUrl)
        if (!result.success) throw new Error(result.error)

        setPreview(publicUrl)
        toast.success("Portada actualizada")
      } catch (err) {
        setPreview(coverUrl)
        toast.error(err instanceof Error ? err.message : "No pudimos subir la portada.")
      } finally {
        URL.revokeObjectURL(previewUrl)
      }
    })
  }

  function handleRemove() {
    if (!preview) return
    setPreview(null)
    startTransition(async () => {
      const result = await updateProfileCover(null)
      if (!result.success) {
        setPreview(coverUrl)
        toast.error(result.error ?? "No pudimos quitar la portada.")
        return
      }
      toast.success("Portada eliminada")
    })
  }

  return (
    <div className="space-y-(--spacing-cluster)">
      <button
        type="button"
        onClick={pickFile}
        disabled={isPending}
        aria-label={preview ? "Cambiar portada" : "Subir portada"}
        className={cn(
          "relative group block w-full aspect-[16/5] rounded-2xl overflow-hidden ring-1 ring-foreground/5 bg-muted",
          "transition-opacity duration-(--duration-state) ease-(--ease-out-quart)",
          isPending && "opacity-60 pointer-events-none",
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Portada del perfil"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <PhotoIcon className="h-8 w-8" />
            <p className="text-xs font-medium">Sin portada · click para subir</p>
          </div>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-foreground/0 group-hover:bg-foreground/30 transition-colors duration-(--duration-state) ease-(--ease-out-quart)">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/95 text-foreground text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-(--duration-state) ease-(--ease-out-quart)">
            <CameraIcon className="h-3.5 w-3.5" />
            {preview ? "Cambiar portada" : "Subir portada"}
          </span>
        </span>
      </button>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          JPG, PNG o WebP · máximo 5 MB · landscape (~3:1) se ve mejor.
        </p>
        {preview && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={isPending}
            className="text-muted-foreground hover:text-destructive"
          >
            <TrashIcon className="h-3.5 w-3.5" />
            Quitar
          </Button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        className="hidden"
        aria-hidden
      />
    </div>
  )
}
