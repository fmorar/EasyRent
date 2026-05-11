"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { revokeInvitation } from "@/lib/actions/invitation.actions"

interface Props {
  invitationId: string
  email:        string
}

export function RevokeInvitationButton({ invitationId, email }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handle() {
    if (!confirm(`¿Revocar la invitación a ${email}?`)) return
    startTransition(async () => {
      const result = await revokeInvitation(invitationId)
      if (!result.success) {
        toast.error(result.error ?? "No se pudo revocar")
        return
      }
      toast.success("Invitación revocada")
      router.refresh()
    })
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={handle}
      disabled={isPending}
      className="text-destructive hover:text-destructive hover:bg-destructive/10"
    >
      {isPending ? "Revocando…" : "Revocar"}
    </Button>
  )
}
