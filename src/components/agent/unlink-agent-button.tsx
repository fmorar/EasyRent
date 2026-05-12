"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { LinkSlashIcon } from "@heroicons/react/24/outline"
import { unlinkAgent } from "@/lib/actions/invitation.actions"

interface Props {
  agentId:    string
  agentName:  string
  agentEmail: string
}

/**
 * Removes the upstream relationship between the current user and the
 * agent they invited. Opens a dialog first that spells out the
 * consequences — shares get revoked in both directions, the agent
 * keeps their own data — so the admin doesn't trigger a destructive
 * change by accident.
 */
export function UnlinkAgentButton({ agentId, agentName, agentEmail }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      const res = await unlinkAgent(agentId)
      if (!res.success) {
        toast.error(res.error ?? "No se pudo desvincular")
        return
      }
      toast.success(`Desvinculaste a ${agentName}`)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        <LinkSlashIcon className="h-3.5 w-3.5 mr-1.5" />
        Desvincular
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Desvincular a {agentName}?</DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <span className="block">
                Quitás a <strong className="text-foreground">{agentEmail}</strong> de tu red.
                Su cuenta y las propiedades que él subió quedan intactas.
              </span>
              <span className="block">
                Lo que sí cambia:
              </span>
              <ul className="list-disc pl-4 space-y-1 text-xs">
                <li>Las propiedades / proyectos / reportes que vos le compartiste dejan de ser visibles para él.</li>
                <li>Lo que él te compartió a vos también deja de ser visible.</li>
                <li>No vas a poder compartirle nada nuevo a menos que lo invités otra vez.</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={pending}
              aria-busy={pending}
            >
              {pending ? "Desvinculando…" : "Sí, desvincular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
