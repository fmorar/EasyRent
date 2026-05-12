"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { PaperAirplaneIcon } from "@heroicons/react/24/outline"
import { resendInvitation } from "@/lib/actions/invitation.actions"

interface Props {
  invitationId: string
  email:        string
}

/**
 * Triggers `resendInvitation` for an existing pending invitation. We keep
 * this distinct from the original send so the table acts as a recovery
 * surface when Resend was down or the agent lost the first email.
 */
export function ResendInvitationButton({ invitationId, email }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handle() {
    startTransition(async () => {
      const result = await resendInvitation(invitationId)
      if (!result.success) {
        toast.error(result.error ?? "No se pudo reenviar")
        return
      }
      if (result.data.emailSent) {
        toast.success(`Invitación reenviada a ${email}`)
      } else {
        toast.error(
          result.data.emailError
            ? `No se pudo enviar el correo: ${result.data.emailError}`
            : "No se pudo enviar el correo. Copiá el link manualmente.",
        )
      }
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
      className="text-muted-foreground hover:text-foreground"
    >
      <PaperAirplaneIcon className="h-3.5 w-3.5 mr-1.5" />
      {isPending ? "Enviando…" : "Reenviar"}
    </Button>
  )
}
