"use client"

import { useEffect, useRef } from "react"

/**
 * Anchor that scrolls itself into view on mount. Placed at the end of
 * the message list so opening a thread lands the user on the latest
 * message — the WhatsApp / iMessage convention.
 *
 * We use `block: "end"` so the parent scroll container's bottom edge
 * aligns with the anchor; `instant` behavior avoids the noticeable
 * cascade animation when navigating between threads.
 */
export function ScrollIntoViewOnMount() {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "end" })
  }, [])
  return <div ref={ref} aria-hidden className="h-px" />
}
