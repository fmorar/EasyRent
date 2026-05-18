"use client"

import { useState, useTransition } from "react"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import { SparklesIcon, ArrowPathIcon } from "@heroicons/react/24/outline"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { generateThreadSummary } from "@/lib/actions/thread-summary.actions"

interface Props {
  conversationId:    string
  initialSummary:    string | null
  initialUpdatedAt:  string | null
}

/**
 * AI summary of the WhatsApp thread.
 *
 * Stored as `leads.extracted_data.thread_summary` so the agent ALSO
 * reads it as background context on long threads (defined in
 * src/lib/whatsapp-agent/state.ts). Generating from the dashboard
 * therefore double-purpose: better operator briefing + better next
 * agent turn.
 *
 * No auto-generate-on-mount: that would cost a model call per page
 * load. The operator decides when to refresh — typically once when
 * picking up a cold thread, then on-demand after key events.
 */
export function ThreadSummaryCard({
  conversationId, initialSummary, initialUpdatedAt,
}: Props) {
  const [summary, setSummary]     = useState<string | null>(initialSummary)
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt)
  const [pending, startTransition] = useTransition()

  function regenerate() {
    startTransition(async () => {
      const res = await generateThreadSummary({ conversationId })
      if (!res.success || !res.summary) {
        toast.error(res.error ?? "No se pudo regenerar.")
        return
      }
      setSummary(res.summary)
      setUpdatedAt(res.updatedAt ?? new Date().toISOString())
      toast.success("Resumen actualizado.")
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <SparklesIcon className="size-4 text-primary" />
            Resumen del thread
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={regenerate}
            disabled={pending}
            title={summary ? "Regenerar resumen" : "Generar resumen"}
          >
            <ArrowPathIcon className={`size-4 ${pending ? "animate-spin" : ""}`} />
            {summary ? "Regenerar" : "Generar"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {summary ? (
          <>
            <p className="whitespace-pre-line leading-relaxed">{summary}</p>
            {updatedAt && (
              <p className="text-[11px] text-muted-foreground pt-1">
                Generado {formatDistanceToNow(new Date(updatedAt), { addSuffix: true, locale: es })}
              </p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground italic">
            Sin resumen aún. Cliqueá &ldquo;Generar&rdquo; para que el AI lea el thread y te dé un brief de 4-5 líneas.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
