"use client"

import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { CameraIcon, TrashIcon } from "@heroicons/react/24/outline"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { updateProfileAvatar } from "@/lib/actions/auth.actions"
import { cn } from "@/lib/utils"

interface Props {
  /** Current authenticated user id — used as the storage folder so
   *  RLS lets the user upload + overwrite + delete their own avatar. */
  userId:    string
  /** Display name — feeds the initials fallback when no photo. */
  fullName:  string
  /** Existing avatar URL (or null when never set). */
  avatarUrl: string | null
}

/** 5 MB — matches the bucket's `file_size_limit`. */
const MAX_BYTES = 5 * 1024 * 1024

/**
 * Avatar upload control for `/settings`. Click the avatar (or the
 * "Cambiar foto" button) → file picker → uploads to the `avatars`
 * bucket under `${userId}/avatar.{ext}` → calls `updateProfileAvatar`
 * with the resulting public URL.
 *
 * The bucket is public + RLS-scoped to the user's folder, so the
 * direct browser upload works without a service-role round-trip.
 */
export function AvatarUploader({ userId, fullName, avatarUrl }: Props) {
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)

  // Optimistic preview — used while the upload is in flight, and
  // again as the canonical URL once the action resolves.
  const [preview, setPreview]     = useState<string | null>(avatarUrl)
  const [isPending, startTransition] = useTransition()

  const initials = (fullName || "")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  function pickFile() {
    inputRef.current?.click()
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // allow picking the same file twice in a row
    if (!file) return

    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      toast.error("Subí una imagen JPG, PNG o WebP.")
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error("La imagen pesa más de 5 MB. Probá con una más liviana.")
      return
    }

    // Optimistic preview from a local object URL.
    const previewUrl = URL.createObjectURL(file)
    setPreview(previewUrl)

    // Stable filename so re-uploads overwrite via upsert. Append a
    // cache-busting query param to the public URL so the browser
    // doesn't serve a stale copy after the swap.
    const ext  = (file.type.split("/")[1] || "jpg").toLowerCase()
    const path = `${userId}/avatar.${ext}`

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

        const result = await updateProfileAvatar(publicUrl)
        if (!result.success) throw new Error(result.error)

        setPreview(publicUrl)
        toast.success("Foto actualizada")
      } catch (err) {
        // Revert the preview to whatever was on disk before.
        setPreview(avatarUrl)
        toast.error(err instanceof Error ? err.message : "No pudimos subir la imagen.")
      } finally {
        URL.revokeObjectURL(previewUrl)
      }
    })
  }

  function handleRemove() {
    if (!preview) return
    setPreview(null)
    startTransition(async () => {
      // We don't bother deleting the storage file — the bucket has a
      // 5 MB limit and the user can re-upload over the same path. If
      // disk hygiene matters later, add a `.remove([path])` here.
      const result = await updateProfileAvatar(null)
      if (!result.success) {
        setPreview(avatarUrl)
        toast.error(result.error ?? "No pudimos quitar la foto.")
        return
      }
      toast.success("Foto eliminada")
    })
  }

  return (
    <div className="flex items-center gap-(--spacing-block)">
      <button
        type="button"
        onClick={pickFile}
        disabled={isPending}
        aria-label={preview ? "Cambiar foto de perfil" : "Subir foto de perfil"}
        className={cn(
          "relative group rounded-full transition-opacity",
          isPending && "opacity-60 pointer-events-none",
        )}
      >
        <Avatar className="h-20 w-20 sm:h-24 sm:w-24 ring-2 ring-background shadow-sm">
          <AvatarImage src={preview ?? undefined} alt={fullName} />
          <AvatarFallback className="text-xl">{initials || "?"}</AvatarFallback>
        </Avatar>
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/0 group-hover:bg-foreground/40 transition-colors duration-(--duration-state) ease-(--ease-out-quart)">
          <CameraIcon
            className="h-5 w-5 text-background opacity-0 group-hover:opacity-100 transition-opacity duration-(--duration-state) ease-(--ease-out-quart)"
            aria-hidden
          />
        </span>
      </button>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={pickFile}
            disabled={isPending}
          >
            {preview ? "Cambiar foto" : "Subir foto"}
          </Button>
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
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          JPG, PNG o WebP · máximo 5 MB · cuadrada se ve mejor.
        </p>
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
