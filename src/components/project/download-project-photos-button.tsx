"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline"

interface Props {
  projectId:    string
  projectSlug:  string
  /** Optional override label for accessibility. Defaults to ES copy. */
  ariaLabel?:   string
}

/**
 * Small icon-only action that streams the project's photos as a ZIP.
 * Matches the property card's "download photos" affordance so the team
 * can grab marketing assets in one click from either place.
 */
export function DownloadProjectPhotosButton({
  projectId, projectSlug, ariaLabel = "Descargar fotos",
}: Props) {
  const [busy, setBusy] = useState(false)

  async function handle(e: React.MouseEvent) {
    // Stop the card's parent <Link> from navigating to the project
    // detail page when the user just wants the photos.
    e.stopPropagation()
    e.preventDefault()
    if (busy) return
    setBusy(true)
    const dismiss = toast.loading("Preparando fotos…")
    try {
      const res = await fetch(`/api/projects/${projectId}/photos.zip`, {
        cache: "no-store",
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      const fname = res.headers.get("Content-Disposition")?.match(/filename="?([^"]+)"?/)?.[1]
                  ?? `${projectSlug || projectId}-fotos.zip`
      a.href     = url
      a.download = fname
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success("Fotos descargadas", { id: dismiss })
    } catch {
      toast.error("No pudimos preparar las fotos. Intentalo de nuevo.", { id: dismiss })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      className="h-7 px-2 text-xs shadow-sm"
      onClick={handle}
      disabled={busy}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <ArrowDownTrayIcon className="h-3.5 w-3.5" />
    </Button>
  )
}
