"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  PhoneIcon, EnvelopeIcon, ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline"

export interface AgentSignatureProps {
  agent: {
    full_name:  string
    slug:       string
    avatar_url: string | null
    phone:      string | null
    email:      string | null
    bio:        string | null
  }
  /** Optional property title to embed in the WhatsApp prefilled message. */
  propertyTitle?: string
  /** ISO string of report creation. Renders "Fecha de elaboración: …". */
  preparedAt?:   string
}

/**
 * Owner-facing signature card. Lives at the bottom of the public market
 * report so the recipient knows who prepared it and how to follow up.
 *
 * Design choices:
 * - Avatar + name + role label (consistent with `<AgentChip>` and the
 *   public agent profile page).
 * - Direct CTAs: WhatsApp (primary), call, email — only render the ones
 *   the agent has on file. Specific verbs per the UX-writing skill.
 * - "Ver perfil del asesor" links to the agent's existing public profile.
 */
export function AgentSignatureBlock({
  agent, propertyTitle, preparedAt,
}: AgentSignatureProps) {
  const t      = useTranslations("marketReportPublic.agentSignature")
  const locale = useLocale()

  const initials = agent.full_name
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const dateLocale = locale === "es" ? "es-CR" : "en-US"
  const formattedDate = preparedAt
    ? new Date(preparedAt).toLocaleDateString(dateLocale, {
        day: "2-digit", month: "long", year: "numeric",
      })
    : null

  // WhatsApp prefill — strip non-digits from phone.
  const waNumber = agent.phone?.replace(/[^\d]/g, "") ?? null
  const waText   = encodeURIComponent(
    t("whatsappPrefill", {
      name:     agent.full_name,
      property: propertyTitle ?? "",
    }),
  )
  const waHref   = waNumber ? `https://wa.me/${waNumber}?text=${waText}` : null
  const telHref  = agent.phone ? `tel:${agent.phone.replace(/\s/g, "")}` : null
  const mailHref = agent.email ? `mailto:${agent.email}` : null

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-5 sm:p-6 space-y-(--spacing-block)">
        {/* Eyebrow + identity cluster — these belong together, so the
            eyebrow sits tight against the avatar+name row. */}
        <div className="space-y-(--spacing-cluster)">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {t("eyebrow")}
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center gap-(--spacing-cluster)">
            <Avatar className="h-14 w-14 sm:h-16 sm:w-16 shrink-0">
              <AvatarImage src={agent.avatar_url ?? undefined} alt={agent.full_name} />
              <AvatarFallback className="text-base font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-lg font-heading font-semibold leading-tight">
                {agent.full_name}
              </p>
              <p className="text-xs text-muted-foreground">{t("agentRoleLabel")}</p>
              {formattedDate && (
                <p className="text-[11px] text-muted-foreground font-numeric">
                  {t("preparedOn")}: {formattedDate}
                </p>
              )}
            </div>

            <Link
              href={`/agents/${agent.slug}`}
              className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground shrink-0 transition-colors duration-(--duration-state) ease-(--ease-out-quart)"
            >
              {t("viewProfile")}
              <ArrowTopRightOnSquareIcon className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Optional bio */}
        {agent.bio && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
            {agent.bio}
          </p>
        )}

        {/* Contact CTAs — wrap on mobile */}
        <div className="flex flex-wrap gap-2">
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-whatsapp text-whatsapp-foreground text-sm font-medium hover:bg-[var(--whatsapp-hover)] transition-colors"
            >
              <WhatsAppGlyph className="h-3.5 w-3.5" />
              {t("whatsappCta")}
            </a>
          )}
          {telHref && (
            <a
              href={telHref}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border bg-background hover:bg-muted text-sm font-medium transition-colors"
            >
              <PhoneIcon className="h-3.5 w-3.5" />
              {t("callCta")}
            </a>
          )}
          {mailHref && (
            <a
              href={mailHref}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border bg-background hover:bg-muted text-sm font-medium transition-colors"
            >
              <EnvelopeIcon className="h-3.5 w-3.5" />
              {t("emailCta")}
            </a>
          )}
        </div>

        {/* Mobile-only "Ver perfil" — keeps the link reachable when CTAs wrap */}
        <Link
          href={`/agents/${agent.slug}`}
          className="sm:hidden inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {t("viewProfile")}
          <ArrowTopRightOnSquareIcon className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  )
}

// Lightweight WhatsApp glyph (Heroicons doesn't ship one)
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M20.52 3.48A12 12 0 0 0 3.48 20.52L2 22l1.55-.4A12 12 0 1 0 20.52 3.48Zm-8.51 18a10 10 0 0 1-5.1-1.4l-.36-.21-3.18.83.85-3.1-.23-.38a10 10 0 1 1 8.02 4.26Zm5.5-7.49c-.3-.15-1.78-.88-2.06-.98s-.48-.15-.68.15-.78.98-.96 1.18-.36.23-.66.08a8.2 8.2 0 0 1-2.42-1.5 9.1 9.1 0 0 1-1.68-2.07c-.18-.3 0-.46.13-.61.13-.13.3-.36.45-.53s.2-.3.3-.5.05-.38-.02-.53-.68-1.65-.93-2.26c-.24-.59-.49-.51-.68-.52h-.58a1.13 1.13 0 0 0-.81.38 3.4 3.4 0 0 0-1.07 2.55 5.92 5.92 0 0 0 1.24 3.13 13.5 13.5 0 0 0 5.18 4.61c.72.31 1.28.5 1.72.64a4.16 4.16 0 0 0 1.9.12 3.1 3.1 0 0 0 2.04-1.44 2.55 2.55 0 0 0 .18-1.44c-.07-.13-.27-.2-.57-.35Z"/>
    </svg>
  )
}
