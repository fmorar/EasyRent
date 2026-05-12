"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { CheckCircleIcon } from "@heroicons/react/24/outline"
import { capturePublicLead } from "@/lib/actions/lead.actions"
import { CountryCodeSelect } from "@/components/shared/country-code-select"
import { cn } from "@/lib/utils"

type ContactPref = "email" | "phone" | "both"

interface Props {
  agentId:    string
  agentName:  string
}

export function AgentContactForm({ agentId, agentName }: Props) {
  const [first,    setFirst]    = useState("")
  const [last,     setLast]     = useState("")
  const [contact,  setContact]  = useState<ContactPref>("email")
  const [email,    setEmail]    = useState("")
  const [phone,    setPhone]    = useState("")
  const [dialCode, setDialCode] = useState("+506")
  const [message,  setMessage]  = useState("")
  const [done,     setDone]     = useState(false)
  const [isPending, startTransition] = useTransition()

  const needsEmail = contact === "email" || contact === "both"
  const needsPhone = contact === "phone" || contact === "both"

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!first.trim() || !last.trim()) {
      toast.error("Escribí tu nombre y apellido.")
      return
    }
    if (needsEmail && !email.trim()) {
      toast.error("Escribí tu correo para que el agente pueda contactarte.")
      return
    }
    if (needsPhone && !phone.trim()) {
      toast.error("Escribí tu WhatsApp con código de país.")
      return
    }

    const fullName = `${first.trim()} ${last.trim()}`
    // Compose phone with the chosen country code; respect any "+" the
    // visitor typed themselves (already international).
    const phoneTrim    = phone.trim()
    const composedPhone = !needsPhone || !phoneTrim
      ? undefined
      : phoneTrim.startsWith("+") ? phoneTrim : `${dialCode} ${phoneTrim}`
    startTransition(async () => {
      const result = await capturePublicLead({
        full_name:      fullName,
        email:          needsEmail ? email : undefined,
        phone:          composedPhone,
        message:        message || undefined,
        source:         "agent_profile",
        source_context: `Agent: ${agentName}`,
        captured_by:    agentId,
      })
      if (!result.success) {
        toast.error(result.error ?? "No pudimos enviar tu mensaje")
        return
      }
      toast.success("¡Mensaje enviado!")
      setDone(true)
    })
  }

  if (done) {
    return (
      <div className="rounded-2xl border bg-card p-8 sm:p-12 text-center space-y-4">
        <CheckCircleIcon className="h-12 w-12 mx-auto text-success" />
        <h3 className="text-xl font-heading font-semibold">¡Mensaje enviado!</h3>
        <p className="text-sm text-muted-foreground">
          {agentName} se pondrá en contacto pronto.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border bg-card p-6 sm:p-8 space-y-6"
    >
      <FormField label="First Name" required>
        <input
          value={first}
          onChange={(e) => setFirst(e.target.value)}
          placeholder="Enter your name"
          disabled={isPending}
          className="w-full rounded-full border bg-background px-4 h-11 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </FormField>

      <FormField label="Last Name" required>
        <input
          value={last}
          onChange={(e) => setLast(e.target.value)}
          placeholder="Enter your last name"
          disabled={isPending}
          className="w-full rounded-full border bg-background px-4 h-11 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </FormField>

      <FormField label="Contact Me By" required>
        <div className="inline-flex p-1 rounded-full bg-muted/60 border w-full sm:w-auto">
          {(["email", "phone", "both"] as ContactPref[]).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setContact(opt)}
              className={cn(
                "px-6 h-9 rounded-full text-sm font-medium transition-colors flex-1 sm:flex-none",
                contact === opt
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt === "email" ? "Email" : opt === "phone" ? "Phone" : "Both"}
            </button>
          ))}
        </div>
      </FormField>

      {needsEmail && (
        <FormField label="Email" required>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={isPending}
            className="w-full rounded-full border bg-background px-4 h-11 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </FormField>
      )}

      {needsPhone && (
        <FormField label="Phone" required>
          <div className="flex items-stretch gap-1.5">
            <CountryCodeSelect
              value={dialCode}
              onChange={(d) => setDialCode(d)}
              disabled={isPending}
              className="h-11 rounded-full"
            />
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="8888 8888"
              disabled={isPending}
              className="flex-1 min-w-0 rounded-full border bg-background px-4 h-11 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </FormField>
      )}

      <FormField label="Message">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter your message"
          rows={4}
          disabled={isPending}
          className="w-full rounded-2xl border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </FormField>

      <button
        type="submit"
        disabled={isPending}
        className="w-full h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm transition-colors disabled:opacity-60"
      >
        {isPending ? "Enviando…" : "Send Message"}
      </button>
    </form>
  )
}

function FormField({
  label,
  required,
  children,
}: {
  label:     string
  required?: boolean
  children:  React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold">
        {label}
        {required && (
          <span className="text-muted-foreground font-normal ml-1.5 text-xs">
            (required)
          </span>
        )}
      </label>
      {children}
    </div>
  )
}
