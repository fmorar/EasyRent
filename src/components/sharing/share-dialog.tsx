"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface Props {
  /** Title of the dialog (e.g. resource title). */
  title:       string
  /** Optional description below the title. */
  description?: React.ReactNode
  /** Optional trigger element. When omitted, the dialog renders no
   *  trigger and must be opened by passing `open` from the parent
   *  (controlled mode — e.g. from a dropdown menu item). */
  children?:   React.ReactNode
  /** Controlled open state. */
  open?:       boolean
  onOpenChange?: (open: boolean) => void
  /** Body content — typically <ShareLinkRow>s, separators, and collaborators. */
  body:        React.ReactNode
  /** Optional max-width override. Defaults to `max-w-6xl` (~1152 px). */
  maxWidth?:   "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl"
}

// Hard rule: a modal must never exceed 60% of the viewport width.
// Each tier is `min(60vw, <pixel-cap>)` so the modal scales down on
// narrower laptops automatically while still capping on huge screens.
//
// `sm:` prefix is required — DialogContent's base class includes
// `sm:max-w-sm` (384 px) which would otherwise win at sm+ breakpoints.
const MAX_WIDTH: Record<NonNullable<Props["maxWidth"]>, string> = {
  md:    "sm:max-w-[min(60vw,28rem)]",   //  448 px cap
  lg:    "sm:max-w-[min(60vw,36rem)]",   //  576 px cap
  xl:    "sm:max-w-[min(60vw,42rem)]",   //  672 px cap
  "2xl": "sm:max-w-[min(60vw,48rem)]",   //  768 px cap
  "3xl": "sm:max-w-[min(60vw,56rem)]",   //  896 px cap
  "4xl": "sm:max-w-[min(60vw,72rem)]",   // 1152 px cap
}

/**
 * Unified share modal — the canonical wrapper used by every "Compartir"
 * surface in the app (dashboard cards, public listing pages, agent profiles…).
 *
 * It is intentionally dumb: it provides the trigger + dialog chrome and
 * renders whatever `body` you pass. Compose with `<ShareLinkRow>` and the
 * resource-specific collaborator panels.
 *
 * Mode is implicit — pass only the link rows the current viewer should see:
 *
 *   • Owner / agent dashboard → public link + unbranded link + collaborators
 *   • Public visitor          → public link only (+ native share buttons)
 */
export function ShareDialog({
  title,
  description,
  children,
  open: controlledOpen,
  onOpenChange,
  body,
  maxWidth = "2xl",
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open    = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Only render a trigger when the parent provided one. Otherwise
          the dialog is controlled purely via the `open` prop and we
          must NOT render a fallback button (it would appear in the UI
          next to whatever externally triggers the open). */}
      {children && (
        <DialogTrigger render={children as React.ReactElement} />
      )}

      <DialogContent className={cn(MAX_WIDTH[maxWidth], "p-0 overflow-hidden")}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b space-y-1">
          <DialogTitle className="font-heading text-lg font-semibold">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-sm text-muted-foreground">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="px-6 py-6 max-h-[75vh] overflow-y-auto">
          {body}
        </div>
      </DialogContent>
    </Dialog>
  )
}
