"use client"

import { useState, useTransition, useRef } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { TrashIcon, PlusIcon } from "@heroicons/react/24/outline"
import {
  setProjectFaqs,
  type ProjectFaqRow,
} from "@/lib/actions/project-media.actions"

type Draft = { id?: string; question: string; answer: string }

interface Props {
  projectId:   string
  initialFaqs: ProjectFaqRow[]
}

export function ProjectFaqsEditor({ projectId, initialFaqs }: Props) {
  const [items, setItems] = useState<Draft[]>(
    initialFaqs.length > 0
      ? initialFaqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer }))
      : [],
  )
  const [isPending, startTransition] = useTransition()
  const [savedAt,   setSavedAt]      = useState<number | null>(null)
  // Snapshot of last persisted state, used to skip no-op saves
  const lastSavedRef = useRef<string>(serialize(items))

  function serialize(list: Draft[]) {
    return JSON.stringify(
      list.map((it) => ({ q: it.question.trim(), a: it.answer.trim() })),
    )
  }

  function persist(list: Draft[]) {
    const cleaned = list.filter((it) => it.question.trim() && it.answer.trim())
    const sig = serialize(cleaned)
    if (sig === lastSavedRef.current) return // no-op
    lastSavedRef.current = sig

    startTransition(async () => {
      const result = await setProjectFaqs(
        projectId,
        cleaned.map(({ question, answer }) => ({ question, answer })),
      )
      if (!result.success) {
        toast.error(result.error ?? "Error al guardar FAQs")
        return
      }
      setSavedAt(Date.now())
      // Refresh local IDs from the server response (preserves text)
      setItems(result.data.map((f) => ({ id: f.id, question: f.question, answer: f.answer })))
    })
  }

  function update(idx: number, patch: Partial<Draft>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  function add() {
    setItems((prev) => [...prev, { question: "", answer: "" }])
    // Don't persist yet — empty rows are filtered out anyway. Persist on blur of fields.
  }

  function remove(idx: number) {
    const next = items.filter((_, i) => i !== idx)
    setItems(next)
    persist(next)        // immediate save on delete
  }

  function handleBlur() {
    persist(items)
  }

  const recentlySaved = savedAt && Date.now() - savedAt < 3000

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Preguntas frecuentes</h3>
          <p className="text-sm text-muted-foreground">
            Aparecerán como acordeón en la página pública. Cambios se guardan automáticamente.
          </p>
        </div>
        <div className="text-xs text-muted-foreground shrink-0 mt-1.5">
          {isPending ? "Guardando…" : recentlySaved ? "✓ Guardado" : null}
        </div>
      </div>

      <div className="space-y-3">
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground italic py-2">
            Aún no hay preguntas. Agrega la primera para empezar.
          </p>
        )}

        {items.map((item, idx) => (
          <div
            key={item.id ?? `draft-${idx}`}
            className="rounded-lg border p-3 space-y-2 bg-card relative"
          >
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold text-muted-foreground mt-2 w-6 shrink-0">
                #{idx + 1}
              </span>
              <Input
                placeholder="¿Qué incluye el precio?"
                value={item.question}
                onChange={(e) => update(idx, { question: e.target.value })}
                onBlur={handleBlur}
                disabled={isPending}
                maxLength={300}
                className="text-sm font-medium"
              />
              <button
                type="button"
                onClick={() => remove(idx)}
                disabled={isPending}
                className="p-1.5 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                aria-label="Eliminar pregunta"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
            <Textarea
              placeholder="Respuesta detallada…"
              rows={3}
              value={item.answer}
              onChange={(e) => update(idx, { answer: e.target.value })}
              onBlur={handleBlur}
              disabled={isPending}
              className="ml-8 text-sm"
            />
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          disabled={isPending}
        >
          <PlusIcon className="h-3.5 w-3.5 mr-1.5" />
          Agregar pregunta
        </Button>
      </div>
    </div>
  )
}
