"use client"

import { Button } from "@/components/ui/button"
import { CheckCircleIcon } from "@heroicons/react/24/outline"
import { useState, useEffect } from "react"

interface Props {
  formId:    string
  label?:    string
  savedLabel?: string
}

/**
 * A submit button that lives OUTSIDE its form.
 * Connects via the HTML `form` attribute — pure browser behavior, no refs.
 *
 * Listens for three custom events:
 *   - "submit"            → set saving = true (native form event)
 *   - "form:saved"        → set saving = false. If `detail.ok === false`,
 *                            don't show the success indicator (a failure)
 *   - "form:dirty-change" → enable/disable the button (detail.dirty: boolean)
 */
export function SaveFormButton({
  formId,
  label      = "Guardar cambios",
  savedLabel = "Cambios guardados",
}: Props) {
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [dirty,  setDirty]  = useState(false)

  useEffect(() => {
    // "form:saved" and "submit" live on the form element itself
    function attachFormListeners() {
      const form = document.getElementById(formId) as HTMLFormElement | null
      if (!form) return null

      function onSubmit() {
        setSaving(true)
        setSaved(false)
      }
      function onSaved(e: Event) {
        setSaving(false)
        // The form dispatches `form:saved` always — success AND failure —
        // so the button always recovers. `detail.ok === false` means
        // failure; only show the green "saved" pill on real success.
        const ok = (e as CustomEvent<{ ok?: boolean }>).detail?.ok !== false
        if (ok) {
          setSaved(true)
          setDirty(false)
          setTimeout(() => setSaved(false), 3000)
        }
      }

      form.addEventListener("submit",      onSubmit)
      form.addEventListener("form:saved",  onSaved)
      return () => {
        form.removeEventListener("submit",     onSubmit)
        form.removeEventListener("form:saved", onSaved)
      }
    }

    // "form:dirty-change" is dispatched on window so it works even when
    // SaveFormButton mounts before PropertyEditClient (and the form element).
    function onDirtyChange(e: Event) {
      const detail = (e as CustomEvent<{ formId: string; dirty: boolean }>).detail
      if (detail.formId !== formId) return
      setDirty(detail.dirty)
      if (detail.dirty) setSaved(false)
    }

    const detachForm = attachFormListeners()
    window.addEventListener("form:dirty-change", onDirtyChange)

    return () => {
      detachForm?.()
      window.removeEventListener("form:dirty-change", onDirtyChange)
    }
  }, [formId])

  const isDisabled = saving || !dirty

  return (
    <div className="flex items-center gap-2">
      {saved && (
        <span className="flex items-center gap-1 text-xs text-success font-medium">
          <CheckCircleIcon className="h-3.5 w-3.5" />
          {savedLabel}
        </span>
      )}
      <Button
        type="submit"
        form={formId}
        disabled={isDisabled}
        size="sm"
      >
        {saving ? "Guardando…" : label}
      </Button>
    </div>
  )
}
