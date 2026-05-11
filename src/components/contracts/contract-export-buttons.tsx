"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline"

interface Props {
  contractId: string
  /** When true, the buttons are disabled (e.g. before fields filled). */
  disabled?:  boolean
}

export function ContractExportButtons({ contractId, disabled }: Props) {
  const [pending, setPending] = useState<"pdf" | "docx" | null>(null)

  async function exportFile(kind: "pdf" | "docx") {
    if (pending) return
    setPending(kind)
    try {
      const res = await fetch(`/api/contracts/${contractId}/export/${kind}`, {
        method: "POST",
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(j?.error ?? "No se pudo generar el archivo.")
        return
      }
      const { download_url, file_name } = await res.json()
      if (download_url) {
        // Trigger browser download via a hidden anchor — keeps the
        // signed URL out of the address bar (which would log it).
        const a = document.createElement("a")
        a.href = download_url
        a.download = file_name
        document.body.appendChild(a)
        a.click()
        a.remove()
        toast.success(`${kind.toUpperCase()} generado: ${file_name}`)
      }
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onClick={() => exportFile("pdf")}
        disabled={disabled || pending !== null}
      >
        <ArrowDownTrayIcon className="h-4 w-4" />
        {pending === "pdf" ? "Generando…" : "Descargar PDF"}
      </Button>
      <Button
        variant="outline"
        onClick={() => exportFile("docx")}
        disabled={disabled || pending !== null}
      >
        <ArrowDownTrayIcon className="h-4 w-4" />
        {pending === "docx" ? "Generando…" : "Descargar DOCX"}
      </Button>
    </div>
  )
}
