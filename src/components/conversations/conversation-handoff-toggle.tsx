"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { HandRaisedIcon, PlayIcon, ArchiveBoxIcon } from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { setConversationStatus } from "@/lib/actions/conversation.actions"
import type { Database } from "@/types/supabase"

type Status = Database["public"]["Enums"]["conversation_status"]

interface Props {
  conversationId: string
  status:         Status
}

/**
 * Per-conversation status controls on the detail page.
 *
 *   open    → "Tomar el control" (sets pending, mutes the bot)
 *   pending → "Reactivar bot"    (sets open, bot replies again)
 *             "Cerrar"          (sets closed, archive)
 *   closed  → "Reabrir"          (sets open)
 *
 * The bot's inbound webhook short-circuits on status !== "open" — so
 * flipping to pending is the immediate kill switch for that single
 * conversation (no global flag needed).
 */
export function ConversationHandoffToggle({ conversationId, status }: Props) {
  const [pending, startTransition] = useTransition()
  const [localStatus, setLocalStatus] = useState<Status>(status)

  function flip(next: Status, optimisticLabel: string) {
    startTransition(async () => {
      const previous = localStatus
      setLocalStatus(next)   // optimistic
      const res = await setConversationStatus(conversationId, next)
      if (!res.success) {
        setLocalStatus(previous)
        toast.error(res.error ?? "No se pudo cambiar el estado.")
        return
      }
      toast.success(optimisticLabel)
    })
  }

  if (localStatus === "open") {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => flip("pending", "Bot pausado. La conversación está bajo tu control.")}
      >
        <HandRaisedIcon className="size-4" />
        Tomar el control
      </Button>
    )
  }
  if (localStatus === "pending") {
    return (
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="default"
          size="sm"
          disabled={pending}
          onClick={() => flip("open", "Bot reactivado. Va a responder al próximo mensaje.")}
        >
          <PlayIcon className="size-4" />
          Reactivar bot
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => flip("closed", "Conversación cerrada.")}
        >
          <ArchiveBoxIcon className="size-4" />
          Cerrar
        </Button>
      </div>
    )
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => flip("open", "Conversación reabierta.")}
    >
      <PlayIcon className="size-4" />
      Reabrir
    </Button>
  )
}
