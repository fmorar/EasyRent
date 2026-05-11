import {
  PhoneIcon,
  EnvelopeIcon,
  ChatBubbleOvalLeftEllipsisIcon,
} from "@heroicons/react/24/outline"
import { MobileContactSticky } from "@/components/layout/mobile-contact-sticky"
import type { ReactNode } from "react"

interface AgentBasic {
  phone:  string | null
  email:  string | null
}

interface Props {
  /** The agent that will receive the lead (phone / email shown as quick links). */
  agent: AgentBasic

  /** Heading shown above the form on desktop. */
  title:       string
  /** Eyebrow uppercase letter-spaced label above the title. */
  eyebrow?:    string
  /** Body copy explaining the section. */
  description: string

  /** Label for the mobile sticky CTA + the modal title. */
  ctaLabel:    string
  /** Optional helper text in the mobile modal. */
  modalHelp?:  string

  /** Form rendered both inside the desktop card and the mobile bottom-sheet. */
  children: ReactNode

  /** Optional id used as anchor target for in-page links. */
  id?: string
}

/**
 * Reusable contact section for public pages.
 *
 * Desktop (`lg+`): two-column section with title + phone/email pills on the
 * left and the form card on the right.
 *
 * Mobile (`<lg`): the section is hidden — instead a sticky bottom bar with
 * phone / WhatsApp shortcuts and a primary CTA opens the form in a
 * bottom-sheet modal.
 *
 * The form (`children`) is rendered twice (one per layout) but only one is
 * visible at a time via CSS. They are independent React instances; in the
 * very rare case of a viewport resize mid-fill, state won't carry over.
 */
export function PublicContactSection({
  agent,
  title,
  eyebrow      = "Contacto",
  description,
  ctaLabel,
  modalHelp,
  children,
  id           = "contact",
}: Props) {
  return (
    <>
      {/* ── Desktop section (hidden on mobile) ─────────────── */}
      <section
        id={id}
        className="hidden lg:block max-w-6xl mx-auto px-6 lg:px-8 py-16 lg:py-24"
      >
        <div className="grid grid-cols-2 gap-16 items-start">
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-4">
                {eyebrow}
              </p>
              <h2 className="text-3xl lg:text-4xl font-heading font-bold tracking-tight">
                {title}
              </h2>
              <p className="mt-4 text-base text-muted-foreground leading-relaxed max-w-md">
                {description}
              </p>
            </div>

            {(agent.phone || agent.email) && (
              <div className="space-y-3 pt-2">
                {agent.phone && (
                  <a
                    href={`tel:${agent.phone}`}
                    className="flex items-center gap-4 group"
                  >
                    <span className="h-10 w-10 rounded-full bg-primary/15 text-foreground flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <PhoneIcon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs text-muted-foreground">Teléfono</p>
                      <p className="text-sm font-numeric font-medium">{agent.phone}</p>
                    </div>
                  </a>
                )}
                {agent.phone && (
                  <a
                    href={`https://wa.me/${agent.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 group"
                  >
                    <span className="h-10 w-10 rounded-full bg-primary/15 text-foreground flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <ChatBubbleOvalLeftEllipsisIcon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs text-muted-foreground">WhatsApp</p>
                      <p className="text-sm font-numeric font-medium">{agent.phone}</p>
                    </div>
                  </a>
                )}
                {agent.email && (
                  <a
                    href={`mailto:${agent.email}`}
                    className="flex items-center gap-4 group"
                  >
                    <span className="h-10 w-10 rounded-full bg-primary/15 text-foreground flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <EnvelopeIcon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs text-muted-foreground">Correo</p>
                      <p className="text-sm font-medium">{agent.email}</p>
                    </div>
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-card p-8 shadow-sm">
            {children}
          </div>
        </div>
      </section>

      {/* ── Mobile sticky bar + bottom-sheet modal ─────────── */}
      <MobileContactSticky
        phone={agent.phone}
        email={agent.email}
        ctaLabel={ctaLabel}
        modalTitle={ctaLabel}
        modalDescription={modalHelp}
      >
        {children}
      </MobileContactSticky>
    </>
  )
}
