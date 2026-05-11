"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline"
import { reviewShare } from "@/lib/actions/share.actions"

interface Props {
  shareId: string
}

export function ShareReviewButtons({ shareId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Reject dialog state (for capturing optional rejection notes)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectNotes, setRejectNotes] = useState("")

  function approve() {
    startTransition(async () => {
      const result = await reviewShare(shareId, "approved")
      if (!result.success) {
        toast.error(result.error ?? "No se pudo aprobar")
        return
      }
      toast.success("Solicitud aprobada")
      router.refresh()
    })
  }

  function reject() {
    setRejectOpen(false)
    startTransition(async () => {
      const result = await reviewShare(shareId, "rejected", rejectNotes.trim() || undefined)
      if (!result.success) {
        toast.error(result.error ?? "No se pudo rechazar")
        return
      }
      toast.success("Solicitud rechazada")
      setRejectNotes("")
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogTrigger render={
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <XMarkIcon className="h-4 w-4 mr-1" />
            Rechazar
          </Button>
        } />
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rechazar solicitud</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-notes">Motivo (opcional)</Label>
            <Textarea
              id="reject-notes"
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Explicación que verá el agente que solicitó…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={reject} disabled={isPending}>
              Confirmar rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button
        type="button"
        size="sm"
        onClick={approve}
        disabled={isPending}
      >
        <CheckIcon className="h-4 w-4 mr-1" />
        Aprobar
      </Button>
    </div>
  )
}
