"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ClipboardIcon, CheckIcon } from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"

interface Props {
  text:  string
  label?: string
}

/**
 * Tiny client component used inside the admin candidate cards.
 *
 * The outreach template renders server-side as plain text; this
 * adds a one-click "copy to clipboard" affordance so the operator
 * can paste the message into any WhatsApp client (Desktop, Web, or
 * mobile) without having to highlight the block manually.
 *
 * Visual feedback: brief check-mark swap on success + a toast.
 * Falls back to a console warning if the clipboard API is blocked
 * (e.g. iOS Safari in some embed contexts) — the toast tells the
 * user to select manually.
 */
export function CopyTemplateButton({ text, label = "Copiar texto" }: Props) {
  const [copied, setCopied] = useState(false)
  async function onClick() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success("Mensaje copiado al portapapeles")
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.warn("[copy-template] clipboard write failed", err)
      toast.error("No se pudo copiar — seleccioná manualmente y copiá.")
    }
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick}>
      {copied ? <CheckIcon className="size-4" /> : <ClipboardIcon className="size-4" />}
      {label}
    </Button>
  )
}
