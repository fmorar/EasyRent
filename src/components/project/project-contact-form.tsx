"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircleIcon } from "@heroicons/react/24/outline"
import { capturePublicLead } from "@/lib/actions/lead.actions"

interface AgentInfo {
  id:         string
  full_name:  string | null
  avatar_url: string | null
  phone:      string | null
  email:      string | null
}

interface Props {
  projectId:    string
  projectTitle: string
  agent:        AgentInfo
}

export function ProjectContactForm({ projectId, projectTitle, agent }: Props) {
  const [name,    setName]    = useState("")
  const [email,   setEmail]   = useState("")
  const [phone,   setPhone]   = useState("")
  const [message, setMessage] = useState("")
  const [done,    setDone]    = useState(false)
  const [isPending, startTransition] = useTransition()

  const initials = (agent.full_name ?? "RE")
    .split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || (!email.trim() && !phone.trim())) {
      toast.error("Nombre y al menos un contacto (correo o teléfono) son requeridos.")
      return
    }
    startTransition(async () => {
      const result = await capturePublicLead({
        full_name:      name,
        email:          email || undefined,
        phone:          phone || undefined,
        message:        message || undefined,
        source:         "project_page",
        source_context: `Proyecto: ${projectTitle}`,
        project_id:     projectId,
        captured_by:    agent.id,
      })
      if (!result.success) {
        toast.error(result.error ?? "No pudimos enviar tu mensaje")
        return
      }
      toast.success("¡Mensaje enviado! El agente se pondrá en contacto pronto.")
      setDone(true)
    })
  }

  if (done) {
    return (
      <div className="text-center space-y-3 py-6">
        <CheckCircleIcon className="h-12 w-12 mx-auto text-success" />
        <p className="text-lg font-medium">¡Gracias por tu interés!</p>
        <p className="text-sm text-muted-foreground">
          {agent.full_name ?? "Un agente"} se pondrá en contacto contigo pronto.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Agent header */}
      <div className="flex items-center gap-3 pb-3 border-b">
        <div className="h-12 w-12 rounded-full bg-primary/15 flex items-center justify-center text-foreground font-semibold shrink-0 overflow-hidden">
          {agent.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={agent.avatar_url} alt={agent.full_name ?? ""} className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{agent.full_name ?? "Agente"}</p>
          <p className="text-xs text-muted-foreground">Tu mensaje irá directo a este agente</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          placeholder="Nombre completo *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isPending}
        />
        <Input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isPending}
        />
      </div>
      <Input
        type="tel"
        placeholder="Teléfono"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        disabled={isPending}
      />
      <Textarea
        placeholder={`Hola, me interesa el proyecto "${projectTitle}"…`}
        rows={3}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={isPending}
      />

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Enviando…" : "Enviar mensaje"}
      </Button>
    </form>
  )
}
