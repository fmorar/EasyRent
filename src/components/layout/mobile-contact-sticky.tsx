"use client"

import { useState, type ReactNode } from "react"
import {
  PhoneIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

interface Props {
  /** Phone number for the call shortcut + WhatsApp link. */
  phone?: string | null
  /** Email for the mailto shortcut (only used when no phone is set). */
  email?: string | null

  /** Label for the primary CTA button. */
  ctaLabel:        string
  /** Title shown at the top of the modal. */
  modalTitle:      string
  /** Optional helper text under the modal title. */
  modalDescription?: string

  /** Form content rendered inside the bottom-sheet modal. */
  children: ReactNode
}

/**
 * Sticky bottom bar (mobile only `<lg`) with phone / WhatsApp shortcuts and
 * a primary CTA that opens a bottom-sheet modal containing arbitrary form
 * content (passed as children).
 *
 * The desktop sidebar should keep showing its own inline contact card —
 * this component is hidden on `lg+`.
 */
export function MobileContactSticky({
  phone,
  email,
  ctaLabel,
  modalTitle,
  modalDescription,
  children,
}: Props) {
  const [open, setOpen] = useState(false)

  if (!phone && !email) return null

  const cleanPhone = phone ? phone.replace(/\D/g, "") : null

  return (
    <>
      {/* Spacer so the bar doesn't cover the last element of the page */}
      <div className="lg:hidden h-20" aria-hidden />

      <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-background/95 backdrop-blur border-t shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2">
          {phone && (
            <a
              href={`tel:${phone}`}
              className="h-12 w-12 shrink-0 rounded-full border bg-background hover:bg-muted flex items-center justify-center text-foreground transition-colors"
              aria-label="Llamar"
            >
              <PhoneIcon className="h-5 w-5" />
            </a>
          )}

          {cleanPhone && (
            <a
              href={`https://wa.me/${cleanPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-12 w-12 shrink-0 rounded-full border bg-background hover:bg-muted flex items-center justify-center text-foreground transition-colors"
              aria-label="WhatsApp"
            >
              <ChatBubbleOvalLeftEllipsisIcon className="h-5 w-5" />
            </a>
          )}

          {email && !phone && (
            <a
              href={`mailto:${email}`}
              className="h-12 w-12 shrink-0 rounded-full border bg-background hover:bg-muted flex items-center justify-center text-foreground transition-colors"
              aria-label="Correo"
            >
              <EnvelopeIcon className="h-5 w-5" />
            </a>
          )}

          {/* Form trigger (bottom-sheet modal) */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={
              <button
                type="button"
                className="flex-1 h-12 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors"
              >
                {ctaLabel}
              </button>
            } />

            <SheetContent
              side="bottom"
              showCloseButton
              className="rounded-t-2xl max-h-[92svh] overflow-y-auto p-6 pb-8 gap-3"
            >
              <SheetTitle className="text-xl font-heading font-bold tracking-tight">
                {modalTitle}
              </SheetTitle>
              {modalDescription && (
                <SheetDescription className="text-sm text-muted-foreground">
                  {modalDescription}
                </SheetDescription>
              )}

              <div className="mt-4">{children}</div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </>
  )
}
