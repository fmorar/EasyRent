"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
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
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Bars3Icon, TrashIcon, PlayCircleIcon } from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert } from "@/components/ui/alert"
import { addVideo, deleteVideo, updateVideoOrder } from "@/lib/actions/media.actions"
import type { VideoRow } from "@/lib/actions/media.actions"

function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (
      parsed.hostname === "www.youtube.com" ||
      parsed.hostname === "youtube.com" ||
      parsed.hostname === "m.youtube.com"
    ) {
      const v = parsed.searchParams.get("v")
      if (v) return v
    }
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.slice(1)
      if (id) return id
    }
  } catch {
    // not a valid URL
  }
  return null
}

function isValidYouTubeUrl(url: string): boolean {
  return extractYouTubeId(url) !== null
}

interface SortableVideoItemProps {
  video: VideoRow
  onDelete: (id: string) => void
}

function SortableVideoItem({ video, onDelete }: SortableVideoItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: video.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const videoId = extractYouTubeId(video.youtube_url)
  const thumbUrl = videoId
    ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
    : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 border rounded-lg p-3 bg-card group"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0"
        aria-label="Arrastrar para reordenar"
      >
        <Bars3Icon className="h-4 w-4" />
      </button>

      {/* Thumbnail */}
      <div className="shrink-0 w-24 h-14 rounded overflow-hidden bg-muted relative">
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt={video.title ?? "Video de YouTube"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <PlayCircleIcon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {video.title && (
          <p className="text-sm font-medium truncate">{video.title}</p>
        )}
        <p className="text-xs text-muted-foreground truncate">{video.youtube_url}</p>
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(video.id)}
        className="shrink-0 p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        aria-label="Eliminar video"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  )
}

interface Props {
  propertyId: string
  initialVideos: VideoRow[]
}

export default function VideoManager({ propertyId, initialVideos }: Props) {
  const [videos, setVideos] = useState<VideoRow[]>(
    [...initialVideos].sort((a, b) => a.order_index - b.order_index)
  )
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [title, setTitle] = useState("")
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [urlError, setUrlError] = useState<string | null>(null)

  // @dnd-kit hydration-mismatch guard (see photo-uploader for details)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  async function handleAdd() {
    setUrlError(null)
    const trimmed = youtubeUrl.trim()
    if (!trimmed) {
      setUrlError("Pegá una URL de YouTube.")
      return
    }
    if (!isValidYouTubeUrl(trimmed)) {
      setUrlError("La URL no es válida. Debe ser del formato youtube.com/watch?v=... o youtu.be/...")
      return
    }

    setAdding(true)
    const result = await addVideo(propertyId, trimmed, title.trim() || undefined)
    setAdding(false)

    if (!result.success) {
      setError(result.error)
      toast.error(result.error ?? "Error al agregar video")
      return
    }

    setVideos((prev) => [...prev, result.data])
    setYoutubeUrl("")
    setTitle("")
    toast.success("Video agregado")
  }

  async function handleDelete(videoId: string) {
    const result = await deleteVideo(videoId)
    if (!result.success) {
      setError(result.error)
      toast.error(result.error ?? "Error al eliminar video")
      return
    }
    setVideos((prev) => prev.filter((v) => v.id !== videoId))
    toast.success("Video eliminado")
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = videos.findIndex((v) => v.id === active.id)
    const newIndex = videos.findIndex((v) => v.id === over.id)

    const reordered = arrayMove(videos, oldIndex, newIndex).map((v, i) => ({
      ...v,
      order_index: i,
    }))

    setVideos(reordered)

    const result = await updateVideoOrder(
      propertyId,
      reordered.map((v) => v.id)
    )
    if (!result.success) {
      setError(result.error)
      toast.error(result.error ?? "Error al reordenar videos")
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Videos</h2>
        <p className="text-sm text-muted-foreground">
          Agrega videos de YouTube para mostrarlos en la página de la propiedad.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <p>{error}</p>
        </Alert>
      )}

      {/* Add video form */}
      <div className="border rounded-xl p-4 space-y-3 bg-muted/30">
        <p className="text-sm font-medium">Agregar video</p>
        <div className="space-y-2">
          <div>
            <Input
              value={youtubeUrl}
              onChange={(e) => { setYoutubeUrl(e.target.value); setUrlError(null) }}
              placeholder="https://www.youtube.com/watch?v=..."
              className={urlError ? "border-destructive" : ""}
              onKeyDown={(e) => { if (e.key === "Enter") void handleAdd() }}
            />
            {urlError && (
              <p className="text-xs text-destructive mt-1">{urlError}</p>
            )}
          </div>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título (opcional)"
            onKeyDown={(e) => { if (e.key === "Enter") void handleAdd() }}
          />
        </div>
        <Button
          onClick={() => void handleAdd()}
          disabled={adding || !youtubeUrl.trim()}
          size="sm"
        >
          {adding ? "Agregando..." : "Agregar"}
        </Button>
      </div>

      {/* Video list */}
      {videos.length > 0 && mounted ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={videos.map((v) => v.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {videos.map((video) => (
                <SortableVideoItem
                  key={video.id}
                  video={video}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          Aún no hay videos agregados.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        {videos.length} video{videos.length !== 1 ? "s" : ""}
      </p>
    </div>
  )
}
