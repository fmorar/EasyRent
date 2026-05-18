"use client"

import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  PaperAirplaneIcon, ExclamationTriangleIcon,
} from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { sendManualReply } from "@/lib/actions/conversation-reply.actions"

interface Props {
  conversationId:   string
  /** True when the lead's last inbound is <24h old (WhatsApp customer-
   *  service window). When false we disable the input and show why. */
  isWithin24hWindow: boolean
  /** ISO timestamp of the last inbound. Used to format the "X hours
   *  ago" hint in the disabled state. Null when no inbound exists. */
  lastInboundAt:    string | null
}

/**
 * Bottom-of-chat compose box. Sends via the manual-reply server action.
 *
 *   • Auto-grows the textarea up to 6 lines, then scrolls internally.
 *   • Enter to send (Shift+Enter for newline) — standard chat behavior.
 *   • Disabled outside the 24h customer-service window with a clear
 *     explanation (Twilio rejects free-form sends with code 63016
 *     in that case; templates will be the unlock when Meta approves).
 *   • On submit: optimistic clear; on error: restore + toast.
 *   • The server action auto-mutes the bot (status=pending) so we
 *     don't double-respond. The Reactivar-bot toggle in the header
 *     undoes that when the human is done.
 */
export function ChatCompose({ conversationId, isWithin24hWindow, lastInboundAt }: Props) {
  const [body, setBody]       = useState("")
  const [pending, startTx]    = useTransition()
  const textareaRef           = useRef<HTMLTextAreaElement | null>(null)

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 180) + "px"
  }

  function submit() {
    const text = body.trim()
    if (!text || pending) return
    const previous = body
    setBody("")           // optimistic clear
    if (textareaRef.current) autoResize(textareaRef.current)
    startTx(async () => {
      const res = await sendManualReply({ conversationId, body: text })
      if (!res.success) {
        setBody(previous)   // restore so the operator can retry/edit
        toast.error(res.error ?? "No se pudo enviar.")
        return
      }
      toast.success("Enviado. El bot quedó en pausa.")
      // The page revalidates via revalidatePath on the server side,
      // so the new message will appear in the thread on the next
      // render. We focus the textarea so the operator can keep typing.
      requestAnimationFrame(() => textareaRef.current?.focus())
    })
  }

  if (!isWithin24hWindow) {
    return (
      <div className="border-t bg-muted/30 px-4 py-3 flex items-start gap-2">
        <ExclamationTriangleIcon className="size-4 text-warning mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Fuera de la ventana de 24h</p>
          <p className="mt-0.5">
            WhatsApp solo permite mensajes libres dentro de las 24h del último inbound del lead.
            {lastInboundAt
              ? <> Último inbound: <span className="font-numeric">{relativeAgo(lastInboundAt)}</span>.</>
              : <> No hay inbound previo en este thread.</>}
            {" "}Esperá a que el lead escriba primero. Las plantillas aprobadas por Meta van a permitir saltarse esto.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit() }}
      className="border-t bg-card px-3 py-3"
    >
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => {
            setBody(e.target.value)
            autoResize(e.currentTarget)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Escribí tu respuesta… (Enter para enviar, Shift+Enter para nueva línea)"
          rows={1}
          className="flex-1 min-h-9 max-h-44 resize-none rounded-md border bg-background px-3 py-2 text-sm leading-tight focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={pending}
        />
        <Button
          type="submit"
          size="sm"
          disabled={pending || body.trim().length === 0}
          className="shrink-0"
        >
          <PaperAirplaneIcon className="size-4" />
          {pending ? "Enviando…" : "Enviar"}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5 ml-1">
        Mandar pausará el bot automáticamente. Reactivalo con el botón &ldquo;Reactivar bot&rdquo; arriba.
      </p>
    </form>
  )
}

function relativeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const h  = Math.floor(ms / (60 * 60 * 1000))
  if (h < 1) return "hace <1h"
  if (h < 48) return `hace ${h}h`
  const d = Math.floor(h / 24)
  return `hace ${d}d`
}
