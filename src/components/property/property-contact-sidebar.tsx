"use client"

import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import {
  PhoneIcon,
  EnvelopeIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/outline"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { trackEvent } from "@/lib/analytics/track"
import { buildWhatsAppLink } from "@/lib/utils"
import { isAdminRole } from "@/lib/roles"
import type { ReactNode } from "react"
import type { Profile } from "@/types"

interface Props {
  /** Used to attribute the click events to the right property in the
   *  performance report. Only events for public surfaces are tracked. */
  propertyId: string
  agent:    Pick<Profile, "full_name" | "slug" | "avatar_url" | "phone" | "email" | "role">
  /** TourForm (or any contact form). Rendered inside the card. */
  form:     ReactNode
  /** Section eyebrow above the form ("Enviar consulta"). */
  eyebrow?: string
  /** Source label fed to events ("branded" | "anonymous"). */
  trackingSource?: string
  /** Prefilled WhatsApp message — appended as `?text=` on the wa.me
   *  link so the visitor's first message identifies the property
   *  they came from (and we can trace it). */
  whatsappMessage?: string
}

/**
 * Sticky right-column contact card for public property pages.
 *
 * Pattern: encuentra24 / Idealista — keeps the form + phone/WhatsApp
 * shortcuts visible while the visitor scrolls through specs, amenities,
 * map, and description on the left.
 *
 * Hidden on `<lg`: the existing `<MobileContactSticky>` handles mobile.
 */
export function PropertyContactSidebar({
  propertyId,
  agent,
  form,
  eyebrow,
  trackingSource = "sidebar",
  whatsappMessage,
}: Props) {
  const t          = useTranslations("publicProperty")
  const initials   = agent.full_name
    .split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
  const isAdmin    = isAdminRole(agent.role)
  const phoneRaw   = agent.phone?.replace(/\D/g, "") ?? ""
  const whatsAppUrl = buildWhatsAppLink(agent.phone, whatsappMessage)
  const eyebrowText = eyebrow ?? t("sendInquiry")

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-(--spacing-block) space-y-(--spacing-tight)">

        {/* Agent / agency identity — links to public profile */}
        <div className="rounded-2xl border bg-card p-5 space-y-(--spacing-cluster)">
          <Link
            href={`/agents/${agent.slug}`}
            className="flex items-start gap-3 group"
          >
            <Avatar className="h-12 w-12 shrink-0 ring-1 ring-transparent group-hover:ring-foreground/10 transition-[box-shadow] duration-(--duration-state) ease-(--ease-out-quart)">
              <AvatarImage src={agent.avatar_url ?? undefined} thumbWidth={48} />
              <AvatarFallback className="text-sm">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-heading font-semibold truncate group-hover:underline underline-offset-4 decoration-foreground/40">
                  {agent.full_name}
                </p>
                {isAdmin && (
                  <CheckBadgeIcon className="h-4 w-4 text-foreground shrink-0" />
                )}
              </div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">
                {isAdmin ? t("verifiedProfessional") : t("agentLabel")}
              </p>
            </div>
          </Link>

          {/* Form */}
          <div className="pt-1 border-t -mx-5 px-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-4 mb-3">
              {eyebrowText}
            </p>
            {form}
          </div>

          {/* Quick actions */}
          {(agent.phone || agent.email) && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              {agent.phone && (
                <a
                  href={`tel:${agent.phone}`}
                  onClick={() => trackEvent({
                    property_id: propertyId,
                    event_type:  "call_clicked",
                    source:      trackingSource,
                  })}
                  className="inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border bg-background hover:bg-muted text-xs font-medium transition-colors duration-(--duration-snap)"
                >
                  <PhoneIcon className="h-3.5 w-3.5" />
                  {t("callCta")}
                </a>
              )}
              {whatsAppUrl && (
                <a
                  href={whatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEvent({
                    property_id: propertyId,
                    event_type:  "whatsapp_clicked",
                    source:      trackingSource,
                  })}
                  className="inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-whatsapp text-whatsapp-foreground hover:bg-[var(--whatsapp-hover)] text-xs font-medium transition-colors duration-(--duration-snap)"
                >
                  <ChatBubbleOvalLeftEllipsisIcon className="h-3.5 w-3.5" />
                  {t("whatsappCta")}
                </a>
              )}
            </div>
          )}

          {/* Email link */}
          {agent.email && (
            <a
              href={`mailto:${agent.email}`}
              onClick={() => trackEvent({
                property_id: propertyId,
                event_type:  "email_clicked",
                source:      trackingSource,
              })}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors duration-(--duration-snap) pt-1"
            >
              <EnvelopeIcon className="h-3.5 w-3.5" />
              <span className="truncate">{agent.email}</span>
            </a>
          )}
        </div>
      </div>
    </aside>
  )
}
