"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  ArrowUpRightIcon,
  CheckCircleIcon,
  CheckIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  ChatBubbleOvalLeftEllipsisIcon,
} from "@heroicons/react/24/outline"
import { capturePublicLead } from "@/lib/actions/lead.actions"
import { cn } from "@/lib/utils"

interface Props {
  agentId:    string
  agentName:  string
  agentEmail: string | null
  agentPhone: string | null
  /** Optional zone summary shown on the bottom "Ubicación" card. */
  locationLabel?: string | null
}

const COMMITMENTS = [
  "Asesoría personalizada",
  "Respuesta en menos de 24h",
  "Documentación verificada",
]

/**
 * Editorial contact band for agent profile pages — same visual
 * vocabulary as `<ProjectContactBand>` (cream surface, decorative
 * "Contacto" backdrop, glass form, 3 contact cards) but with
 * agent-focused copy and lead-source.
 */
export function AgentContactBand({
  agentId, agentName, agentEmail, agentPhone, locationLabel,
}: Props) {
  const [name,    setName]    = useState("")
  const [email,   setEmail]   = useState("")
  const [message, setMessage] = useState("")
  const [done,    setDone]    = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      toast.error(`Escribí tu nombre y correo para que ${agentName.split(" ")[0]} te contacte.`)
      return
    }
    startTransition(async () => {
      const result = await capturePublicLead({
        full_name:      name,
        email:          email || undefined,
        message:        message || undefined,
        source:         "agent_profile",
        source_context: `Asesor: ${agentName}`,
        captured_by:    agentId,
      })
      if (!result.success) {
        toast.error(result.error ?? "No pudimos enviar tu mensaje. Probá de nuevo.")
        return
      }
      toast.success("¡Mensaje enviado!")
      setDone(true)
    })
  }

  const waNumber = agentPhone?.replace(/[^\d]/g, "") ?? null
  const waText   = encodeURIComponent(
    `Hola ${agentName}, vi tu perfil y me gustaría hablar.`,
  )
  const waHref   = waNumber ? `https://wa.me/${waNumber}?text=${waText}` : null

  const firstName = agentName.split(" ")[0]

  return (
    <section
      id="contact"
      className="relative isolate overflow-hidden"
    >
      {/* Decorative backdrop wordmark — sutil sobre cream */}
      <div
        className="absolute inset-x-0 top-0 pointer-events-none select-none"
        aria-hidden
      >
        <p
          className="font-heading font-black tracking-tight whitespace-nowrap text-center text-foreground/[0.04]"
          style={{
            fontSize: "clamp(6rem, 18vw, 16rem)",
            letterSpacing: "-0.05em",
            lineHeight: 0.85,
            marginTop: "-2%",
          }}
        >
          Contacto
        </p>
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-(--spacing-major)">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-(--spacing-section) lg:gap-(--spacing-major)">
          {/* Left rail */}
          <div className="lg:col-span-5 space-y-(--spacing-block)">
            <div className="space-y-(--spacing-cluster)">
              <h2
                className="font-heading font-bold tracking-tight leading-[0.98] text-foreground inline-flex items-start gap-3"
                style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)" }}
              >
                Hablá con{" "}
                <span className="text-foreground/40">{firstName}</span>
                <ArrowUpRightIcon className="h-8 w-8 sm:h-12 sm:w-12 shrink-0 mt-1 text-foreground" />
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-md">
                Dejanos tus datos y{" "}
                <span className="font-semibold text-foreground">{agentName}</span>
                {" "}te contacta para resolver dudas y coordinar visitas a las propiedades que te interesen.
              </p>
            </div>

            <ul className="space-y-(--spacing-cluster) pt-(--spacing-tight)">
              {COMMITMENTS.map((c) => (
                <li key={c} className="flex items-center gap-3 text-sm text-foreground/85">
                  <span className="h-7 w-7 rounded-full bg-foreground text-background flex items-center justify-center shrink-0">
                    <CheckIcon className="h-3.5 w-3.5" />
                  </span>
                  {c}
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2 pt-(--spacing-tight)">
              <SocialPill href="https://instagram.com" label="Instagram" external>
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
                  <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9s.68.82.9 1.38c.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38s-.82.68-1.38.9c-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9s-.68-.82-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38s.82-.68 1.38-.9c.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zm0-2.16C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.78.3-1.45.71-2.12 1.38S.93 3.36.63 4.14C.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.78.71 1.45 1.38 2.12s1.34 1.08 2.12 1.38c.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.78-.3 1.45-.71 2.12-1.38s1.08-1.34 1.38-2.12c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.3-.78-.71-1.45-1.38-2.12S20.64.93 19.86.63C19.1.33 18.22.13 16.95.07 15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 12 18.16 6.16 6.16 0 0 0 12 5.84zm0 10.16A4 4 0 1 1 12 8a4 4 0 0 1 0 8zm6.4-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z"/>
                </svg>
              </SocialPill>
              <SocialPill href="https://facebook.com" label="Facebook" external>
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
                  <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.96.93-1.96 1.89v2.27h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07z"/>
                </svg>
              </SocialPill>
              {waHref && (
                <SocialPill href={waHref} label="WhatsApp" external>
                  <ChatBubbleOvalLeftEllipsisIcon className="h-4 w-4" />
                </SocialPill>
              )}
            </div>
          </div>

          {/* Right rail · form card */}
          <div className="lg:col-span-7">
            {done ? (
              <div className="rounded-3xl bg-card ring-1 ring-foreground/5 shadow-sm p-(--spacing-section) text-center space-y-(--spacing-cluster)">
                <CheckCircleIcon className="h-12 w-12 mx-auto text-success" />
                <p className="text-lg font-medium">¡Mensaje enviado!</p>
                <p className="text-sm text-muted-foreground">
                  {firstName} te contactará pronto.
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="rounded-3xl bg-card ring-1 ring-foreground/5 shadow-sm p-(--spacing-block) sm:p-(--spacing-section) space-y-(--spacing-cluster)"
                noValidate
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-(--spacing-cluster)">
                  <FormInput
                    type="text"
                    placeholder="Nombre"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isPending}
                    autoComplete="name"
                    required
                  />
                  <FormInput
                    type="email"
                    placeholder="Correo"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isPending}
                    autoComplete="email"
                    required
                  />
                </div>
                <FormTextarea
                  placeholder={`Hola ${firstName}, me gustaría hablar sobre…`}
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={isPending}
                />
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full h-14 rounded-2xl bg-foreground text-background text-base font-bold hover:bg-foreground/90 transition-colors duration-(--duration-state) ease-(--ease-out-quart) disabled:opacity-60"
                >
                  {isPending ? "Enviando…" : "Enviar mensaje"}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Bottom · 3 contact cards */}
        <div className="mt-(--spacing-major) grid grid-cols-1 sm:grid-cols-3 gap-(--spacing-cluster)">
          {agentEmail && (
            <ContactCard
              icon={<EnvelopeIcon className="h-4 w-4" />}
              label="Escribinos"
              value={agentEmail}
              href={`mailto:${agentEmail}`}
            />
          )}
          {agentPhone && (
            <ContactCard
              icon={<PhoneIcon className="h-4 w-4" />}
              label="Llamanos"
              value={agentPhone}
              href={`tel:${agentPhone}`}
            />
          )}
          <ContactCard
            icon={<MapPinIcon className="h-4 w-4" />}
            label="Zonas"
            value={locationLabel ?? "Costa Rica · Gran Área Metropolitana"}
          />
        </div>
      </div>
    </section>
  )
}

// ── Sub-components ────────────────────────────────────────────────

function FormInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full h-14 px-4 rounded-2xl bg-background ring-1 ring-foreground/10 text-foreground placeholder:text-muted-foreground",
        "text-sm focus:outline-none focus:ring-2 focus:ring-foreground/30 transition-shadow duration-(--duration-state) ease-(--ease-out-quart)",
        "disabled:opacity-60",
      )}
    />
  )
}

function FormTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full px-4 py-3 rounded-2xl bg-background ring-1 ring-foreground/10 text-foreground placeholder:text-muted-foreground",
        "text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-foreground/30 transition-shadow duration-(--duration-state) ease-(--ease-out-quart)",
        "disabled:opacity-60",
      )}
    />
  )
}

function SocialPill({
  href, label, children, external,
}: {
  href:      string
  label:     string
  children:  React.ReactNode
  external?: boolean
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      aria-label={label}
      className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-foreground text-background hover:bg-foreground/85 transition-colors duration-(--duration-state) ease-(--ease-out-quart)"
    >
      {children}
    </a>
  )
}

function ContactCard({
  icon, label, value, href,
}: {
  icon:  React.ReactNode
  label: string
  value: string
  href?: string
}) {
  const inner = (
    <div className="rounded-2xl bg-card ring-1 ring-foreground/5 shadow-sm p-(--spacing-block) hover:shadow-md transition-shadow duration-(--duration-state) ease-(--ease-out-quart) h-full">
      <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-muted text-foreground/85 mb-(--spacing-cluster)">
        {icon}
      </span>
      <p className="text-base font-heading font-semibold text-foreground">
        {label}
      </p>
      <p className="text-sm text-muted-foreground mt-1 truncate">
        {value}
      </p>
    </div>
  )
  return href ? (
    <a href={href} className="block h-full">
      {inner}
    </a>
  ) : (
    inner
  )
}
