"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ArrowPathRoundedSquareIcon as GitFork } from "@heroicons/react/24/outline"
import { forkProject } from "@/lib/actions/project.actions"

interface Props {
  projectId:    string
  projectTitle: string
}

export function ForkProjectButton({ projectId, projectTitle }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  function handleFork() {
    startTransition(async () => {
      const result = await forkProject(projectId)
      if (!result.success) {
        toast.error(result.error ?? "No se pudo forkear el proyecto")
        return
      }
      toast.success(`"${projectTitle}" forkeado — abriendo tu copia…`)
      setDone(true)
      router.push(`/projects/${result.data.slug}/edit`)
      router.refresh()
    })
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="h-7 px-2 text-xs shadow-sm"
      onClick={handleFork}
      disabled={isPending || done}
    >
      <GitFork className="h-3.5 w-3.5 mr-1" />
      {isPending ? "Forkeando…" : "Forkear"}
    </Button>
  )
}
