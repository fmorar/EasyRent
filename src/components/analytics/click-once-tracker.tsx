"use client"

import { useRef } from "react"
import { trackEvent } from "@/lib/analytics/track"
import type { PublicEventType } from "@/lib/analytics/schemas"

interface Props {
  propertyId: string
  eventType:  PublicEventType
  source?:    string
  /** The gallery / map / video section to wrap. */
  children:   React.ReactNode
  /** Optional className for the wrapper div. */
  className?: string
}

/**
 * Wraps any clickable region and fires a single event the first time
 * the user clicks anywhere inside it. Used for gallery/map/video sections
 * where we don't want to instrument every individual button (yet still
 * want to record "the visitor explored the gallery").
 *
 * The handler attaches to the wrapper at capture phase so it sees the
 * click even when the inner component stops propagation.
 */
export function ClickOnceTracker({
  propertyId, eventType, source, children, className,
}: Props) {
  const firedRef = useRef(false)

  function handleClick() {
    if (firedRef.current) return
    firedRef.current = true
    trackEvent({ property_id: propertyId, event_type: eventType, source })
  }

  return (
    <div onClickCapture={handleClick} className={className}>
      {children}
    </div>
  )
}
