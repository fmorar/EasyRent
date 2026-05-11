"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { AmenitiesPicker } from "@/components/property/amenities-picker"
import {
  setProjectAmenities,
  type ProjectAmenityRow,
} from "@/lib/actions/project-media.actions"

interface Props {
  projectId:        string
  initialAmenities: ProjectAmenityRow[]
  /** Bubble up the current name list so a parent (preview) stays in sync. */
  onChange?:        (names: string[]) => void
}

export function ProjectAmenitiesEditor({ projectId, initialAmenities, onChange }: Props) {
  // We work with the names list locally; persist on every change with debouncing
  // would be over-engineering — we simply save on every toggle. Worst case is
  // O(N) DB writes for a session, but volume is low.
  const [names, setNames] = useState<string[]>(
    initialAmenities.sort((a, b) => a.sort_order - b.sort_order).map((a) => a.name),
  )
  const [isPending, startTransition] = useTransition()

  function handleChange(next: string[]) {
    const previous = names
    setNames(next)         // optimistic local
    onChange?.(next)        // bubble to parent (preview)

    startTransition(async () => {
      const result = await setProjectAmenities(projectId, next)
      if (!result.success) {
        setNames(previous)
        onChange?.(previous)
        toast.error(result.error ?? "Error al guardar amenidades")
      }
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold">Amenidades del proyecto</h3>
        <p className="text-sm text-muted-foreground">
          Lo que ofrece el edificio. Las propiedades dentro del proyecto las heredan automáticamente.
        </p>
      </div>
      <AmenitiesPicker
        value={names}
        onChange={handleChange}
        disabled={isPending}
      />
    </div>
  )
}
