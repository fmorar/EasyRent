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
import { Input } from "@/components/ui/input"
import { Alert } from "@/components/ui/alert"
import {
  updateProjectPhotoOrder,
  deleteProjectPhoto,
  updateProjectPhotoCaption,
  type ProjectPhotoRow,
} from "@/lib/actions/project-media.actions"
import { convertHeicToJpegIfNeeded, looksLikeHeic } from "@/lib/heic-to-jpeg"

interface SortablePhotoCardProps {
  photo: ProjectPhotoRow
  isCover: boolean
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
    await updateProjectPhotoCaption(photo.id, caption)
    onCaptionChange(photo.id, caption)
    setSaving(false)
  }

  function handleDeleteClick() {
    if (removing) return
    setRemoving(true)
    window.setTimeout(() => onDelete(photo.id), 200)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative rounded-lg border bg-card overflow-hidden group will-change-transform"
    >
      <button
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-10 p-1 rounded bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-(--duration-state) ease-(--ease-out-quart) cursor-grab active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <Bars3Icon className="h-4 w-4" />
      </button>

      {isCover && (
        <Badge className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground hover:bg-primary">
          Portada
        </Badge>
      )}

      <button
        onClick={handleDeleteClick}
        disabled={removing}
        className="absolute bottom-2 right-2 z-10 p-1.5 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-[opacity,background-color] duration-(--duration-state) ease-(--ease-out-quart) hover:bg-destructive disabled:opacity-50"
        aria-label="Eliminar foto"
      >
        <TrashIcon className="h-4 w-4" />
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.caption ?? "Foto del proyecto"}
        className="w-full h-40 object-cover"
      />

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
  key:      string
  name:     string
  progress: number
  error:    string | null
}

interface Props {
  projectId:     string
  initialPhotos: ProjectPhotoRow[]
}

export default function ProjectPhotoUploader({ projectId, initialPhotos }: Props) {
  const [photos, setPhotos] = useState<ProjectPhotoRow[]>(
    [...initialPhotos].sort((a, b) => a.order_index - b.order_index),
  )
  const [uploading, setUploading] = useState<UploadingFile[]>([])
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  async function uploadFile(file: File) {
    const key = `${Date.now()}-${Math.random()}`
    setUploading((prev) => [...prev, { key, name: file.name, progress: 0, error: null }])

    const path = `${projectId}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`

    const { error: uploadErr } = await supabase.storage
      .from("project-photos")
      .upload(path, file, { upsert: false })

    if (uploadErr) {
      setUploading((prev) =>
        prev.map((u) => (u.key === key ? { ...u, progress: 0, error: uploadErr.message } : u)),
      )
      return
    }

    setUploading((prev) =>
      prev.map((u) => (u.key === key ? { ...u, progress: 80 } : u)),
    )

    const { data: urlData } = supabase.storage
      .from("project-photos")
      .getPublicUrl(path)
    const url = urlData.publicUrl

    const maxOrderIndex = photos.reduce((max, p) => Math.max(max, p.order_index), -1)

    const { data: inserted, error: insertErr } = await supabase
      .from("project_photos")
      .insert({
        project_id:   projectId,
        url,
        storage_path: path,
        type:         "gallery",
        is_cover:     photos.length === 0,
        order_index:  maxOrderIndex + 1,
        caption:      null,
      })
      .select()
      .single()

    if (insertErr) {
      setUploading((prev) =>
        prev.map((u) => (u.key === key ? { ...u, error: insertErr.message } : u)),
      )
      return
    }

    setUploading((prev) =>
      prev.map((u) => (u.key === key ? { ...u, progress: 100 } : u)),
    )

    setPhotos((prev) => [...prev, inserted as ProjectPhotoRow])

    setTimeout(() => {
      setUploading((prev) => prev.filter((u) => u.key !== key))
    }, 1000)
  }

  async function handleFiles(files: FileList | File[]) {
    setGlobalError(null)
    const fileArray = Array.from(files)

    // HEIC reports an empty MIME on iOS Safari — accept via filename
    // fallback. Size check stays a hard limit.
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

    let prepared: File[]
    try {
      prepared = await Promise.all(fileArray.map(convertHeicToJpegIfNeeded))
    } catch (err) {
      console.error("[project-photo-uploader] HEIC conversion failed:", err)
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
    const result = await deleteProjectPhoto(photoId)
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
      prev.map((p) => (p.id === photoId ? { ...p, caption } : p)),
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
      is_cover:    i === 0,
    }))
    setPhotos(reordered)

    const result = await updateProjectPhotoOrder(
      projectId,
      reordered.map((p) => p.id),
    )
    if (!result.success) setGlobalError(result.error)
  }

  const onDropZoneClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return (
    <div className="space-y-(--spacing-cluster)">
      <div>
        <h3 className="text-base font-semibold">Fotos del proyecto</h3>
        <p className="text-sm text-muted-foreground">
          Fachada, amenidades, áreas comunes. Las propiedades del proyecto las heredan automáticamente.
        </p>
      </div>

      {globalError && (
        <Alert variant="destructive">
          <p>{globalError}</p>
        </Alert>
      )}

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
          // .heic/.heif explicit — iOS Safari doesn't always honor
          // image/* for HEIC files.
          accept="image/*,.heic,.heif"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
      </div>

      {uploading.length > 0 && (
        <div className="space-y-2">
          {uploading.map((u) => (
            <div key={u.key} className="text-sm">
              <div className="flex justify-between mb-1">
                <span className="truncate max-w-xs text-muted-foreground">{u.name}</span>
                {u.error
                  ? <span className="text-destructive text-xs">{u.error}</span>
                  : <span className="text-xs">{u.progress}%</span>}
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

      {photos.length > 0 && mounted && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
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
          Aún no hay fotos del proyecto.
        </p>
      )}

      <div className="text-xs text-muted-foreground">
        {photos.length} foto{photos.length !== 1 ? "s" : ""}
      </div>
    </div>
  )
}
