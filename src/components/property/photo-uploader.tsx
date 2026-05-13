"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Bars3Icon, TrashIcon, PhotoIcon } from "@heroicons/react/24/outline"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert } from "@/components/ui/alert"
import { updatePhotoOrder, deletePhoto, updatePhotoCaption } from "@/lib/actions/media.actions"
import { looksLikeHeic } from "@/lib/heic-to-jpeg"
import { prepareImageForUpload } from "@/lib/image-pipeline"

export type PhotoRow = {
  id: string
  url: string
  storage_path: string | null
  is_cover: boolean
  order_index: number
  caption: string | null
}

interface SortablePhotoCardProps {
  photo: PhotoRow
  isCover: boolean
  uploadProgress?: number
  onDelete: (id: string) => void
  onCaptionChange: (id: string, caption: string) => void
}

function SortablePhotoCard({
  photo,
  isCover,
  onDelete,
  onCaptionChange,
}: SortablePhotoCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: photo.id })

  const [removing, setRemoving] = useState(false)

  // While removing, override @dnd-kit's transform/transition so we can scale
  // and fade out in 200ms (transform/opacity only — never width/height) before
  // the parent unmounts the node.
  const style = {
    transform: removing ? "scale(0.92)" : CSS.Transform.toString(transform),
    transition: removing
      ? "transform 200ms cubic-bezier(0.25, 1, 0.5, 1), opacity 200ms cubic-bezier(0.25, 1, 0.5, 1)"
      : transition,
    opacity: removing ? 0 : isDragging ? 0.5 : 1,
  }

  const [caption, setCaption] = useState(photo.caption ?? "")
  const [saving, setSaving] = useState(false)

  async function handleCaptionBlur() {
    if (caption === (photo.caption ?? "")) return
    setSaving(true)
    await updatePhotoCaption(photo.id, caption)
    onCaptionChange(photo.id, caption)
    setSaving(false)
  }

  function handleDeleteClick() {
    if (removing) return
    setRemoving(true)
    // Wait for the exit transition before the parent removes us from the list.
    window.setTimeout(() => onDelete(photo.id), 200)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative rounded-lg border bg-card overflow-hidden group will-change-transform"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-10 p-1 rounded bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-(--duration-state) ease-(--ease-out-quart) cursor-grab active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <Bars3Icon className="h-4 w-4" />
      </button>

      {/* Cover badge */}
      {isCover && (
        <Badge className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground hover:bg-primary">
          Portada
        </Badge>
      )}

      {/* Delete button */}
      <button
        onClick={handleDeleteClick}
        disabled={removing}
        className="absolute bottom-2 right-2 z-10 p-1.5 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-[opacity,background-color] duration-(--duration-state) ease-(--ease-out-quart) hover:bg-destructive disabled:opacity-50"
        aria-label="Eliminar foto"
      >
        <TrashIcon className="h-4 w-4" />
      </button>

      {/* Thumbnail — aspect-ratio (not fixed height) so the card stays
          proportional as the grid grows on wider monitors. With h-40
          the card stretched to 500+ px wide on 32" displays while the
          photo stayed 160 px tall, producing a thin strip. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.caption ?? "Foto de propiedad"}
        className="w-full aspect-[4/3] object-cover"
      />

      {/* Caption */}
      <div className="p-2">
        <Input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={handleCaptionBlur}
          placeholder="Descripción (opcional)"
          className="text-xs h-7"
          disabled={saving}
        />
      </div>
    </div>
  )
}

interface UploadingFile {
  key: string
  name: string
  progress: number
  error: string | null
}

interface Props {
  propertyId: string
  initialPhotos: PhotoRow[]
}

export default function PhotoUploader({ propertyId, initialPhotos }: Props) {
  const [photos, setPhotos] = useState<PhotoRow[]>(
    [...initialPhotos].sort((a, b) => a.order_index - b.order_index)
  )
  const [uploading, setUploading] = useState<UploadingFile[]>([])
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  // @dnd-kit generates incremental "DndDescribedBy-{n}" IDs that don't match
  // between server and client → hydration mismatch. Defer DnD rendering until
  // after hydration to avoid the mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  async function uploadFile(file: File) {
    const key = `${Date.now()}-${Math.random()}`

    setUploading((prev) => [...prev, { key, name: file.name, progress: 0, error: null }])

    const path = `${propertyId}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`

    const { error: uploadErr } = await supabase.storage
      .from("property-photos")
      .upload(path, file, { upsert: false })

    if (uploadErr) {
      setUploading((prev) =>
        prev.map((u) => (u.key === key ? { ...u, progress: 0, error: uploadErr.message } : u))
      )
      return
    }

    setUploading((prev) =>
      prev.map((u) => (u.key === key ? { ...u, progress: 80 } : u))
    )

    const { data: urlData } = supabase.storage
      .from("property-photos")
      .getPublicUrl(path)

    const url = urlData.publicUrl

    const maxOrderIndex = photos.reduce((max, p) => Math.max(max, p.order_index), -1)

    const { data: inserted, error: insertErr } = await supabase
      .from("property_photos")
      .insert({
        property_id: propertyId,
        url,
        storage_path: path,
        is_cover: photos.length === 0,
        order_index: maxOrderIndex + 1,
        caption: null,
      })
      .select()
      .single()

    if (insertErr) {
      setUploading((prev) =>
        prev.map((u) => (u.key === key ? { ...u, error: insertErr.message } : u))
      )
      return
    }

    setUploading((prev) =>
      prev.map((u) => (u.key === key ? { ...u, progress: 100 } : u))
    )

    setPhotos((prev) => [
      ...prev,
      {
        id: inserted.id,
        url: inserted.url,
        storage_path: inserted.storage_path,
        is_cover: inserted.is_cover,
        order_index: inserted.order_index,
        caption: inserted.caption,
      },
    ])

    // Remove from uploading list after short delay
    setTimeout(() => {
      setUploading((prev) => prev.filter((u) => u.key !== key))
    }, 1000)
  }

  async function handleFiles(files: FileList | File[]) {
    setGlobalError(null)
    const fileArray = Array.from(files)

    // Validate before conversion. HEIC files often report an empty
    // `type` on iOS Safari, so accept them via the filename fallback.
    const tooBig    = fileArray.filter((f) => f.size > 10 * 1024 * 1024)
    const wrongKind = fileArray.filter(
      (f) => !f.type.startsWith("image/") && !looksLikeHeic(f),
    )
    if (tooBig.length > 0 || wrongKind.length > 0) {
      const msg = "Solo se aceptan imágenes de hasta 10 MB."
      setGlobalError(msg)
      toast.error(msg)
      return
    }

    // Normalise + compress + strip EXIF before upload. Pipeline:
    //   HEIC → JPEG  →  resize to 2400px  →  re-encode @ q=0.85
    //   →  drop EXIF (GPS, camera serial, timestamps).
    // Trims a 12 MB iPhone photo down to ~1.5 MB without visible loss.
    let prepared: File[]
    try {
      prepared = await Promise.all(fileArray.map(prepareImageForUpload))
    } catch (err) {
      console.error("[photo-uploader] image pipeline failed:", err)
      const msg = "No pudimos procesar una de las fotos. Probá con JPG o PNG."
      setGlobalError(msg)
      toast.error(msg)
      return
    }

    await Promise.all(prepared.map(uploadFile))
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      void handleFiles(e.target.files)
      e.target.value = ""
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      void handleFiles(e.dataTransfer.files)
    }
  }

  async function handleDelete(photoId: string) {
    const result = await deletePhoto(photoId)
    if (!result.success) {
      setGlobalError(result.error)
      toast.error(result.error ?? "Error al eliminar foto")
      return
    }
    setPhotos((prev) => prev.filter((p) => p.id !== photoId))
    toast.success("Foto eliminada")
  }

  function handleCaptionChange(photoId: string, caption: string) {
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, caption } : p))
    )
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = photos.findIndex((p) => p.id === active.id)
    const newIndex = photos.findIndex((p) => p.id === over.id)

    const reordered = arrayMove(photos, oldIndex, newIndex).map((p, i) => ({
      ...p,
      order_index: i,
      is_cover: i === 0,
    }))

    setPhotos(reordered)

    const result = await updatePhotoOrder(
      propertyId,
      reordered.map((p) => p.id)
    )
    if (!result.success) {
      setGlobalError(result.error)
    }
  }

  const onDropZoneClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return (
    <div className="space-y-(--spacing-cluster)">
      <div>
        <h2 className="text-base font-semibold">Fotos</h2>
        <p className="text-sm text-muted-foreground">
          Arrastra para reordenar. La primera foto será la portada.
        </p>
      </div>

      {globalError && (
        <Alert variant="destructive">
          <p>{globalError}</p>
        </Alert>
      )}

      {/* Drop zone */}
      <div
        onClick={onDropZoneClick}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors duration-(--duration-snap) ease-(--ease-out-quart) ${
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
        }`}
      >
        <PhotoIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-medium">Haz clic o arrastra fotos aquí</p>
        <p className="text-xs text-muted-foreground mt-1">
          Solo imágenes · Máx. 10 MB por archivo
        </p>
        <input
          ref={fileInputRef}
          type="file"
          // .heic/.heif explicit because iOS Safari doesn't always
          // include HEIC under the image/* MIME wildcard.
          accept="image/*,.heic,.heif"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
      </div>

      {/* Uploading files progress */}
      {uploading.length > 0 && (
        <div className="space-y-2">
          {uploading.map((u) => (
            <div key={u.key} className="text-sm">
              <div className="flex justify-between mb-1">
                <span className="truncate max-w-xs text-muted-foreground">{u.name}</span>
                {u.error ? (
                  <span className="text-destructive text-xs">{u.error}</span>
                ) : (
                  <span className="text-xs">{u.progress}%</span>
                )}
              </div>
              {!u.error && (
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-[width] duration-(--duration-reveal) ease-(--ease-out-quart)"
                    style={{ width: `${u.progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Sortable photo grid — only rendered after hydration to avoid
          @dnd-kit's incremental ID hydration mismatch */}
      {photos.length > 0 && mounted && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={photos.map((p) => p.id)}
            strategy={rectSortingStrategy}
          >
            {/* Extra columns at xl/2xl so 32" displays don't blow each
                card up to 500+ px wide. */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              {photos.map((photo, index) => (
                <SortablePhotoCard
                  key={photo.id}
                  photo={photo}
                  isCover={index === 0}
                  onDelete={handleDelete}
                  onCaptionChange={handleCaptionChange}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {photos.length === 0 && uploading.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Todavía no hay fotos. Subí algunas — la primera será la portada.
        </p>
      )}

      <div className="text-xs text-muted-foreground">
        <span>{photos.length} foto{photos.length !== 1 ? "s" : ""}</span>
      </div>
    </div>
  )
}
