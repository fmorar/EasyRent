"use client"

import { useState } from "react"

interface Props {
  src:        string | undefined
  authorName: string
  className?: string
}

/**
 * Renders the reviewer's Google profile photo, with referrer stripping (Google
 * blocks hot-linking when Referer is a non-Google origin) and a graceful
 * fallback to initials if the image still fails.
 */
export function ReviewerAvatar({ src, authorName, className }: Props) {
  const [errored, setErrored] = useState(false)

  const initials = authorName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const showInitials = !src || errored

  if (showInitials) {
    return (
      <div className={`${className ?? ""} bg-muted flex items-center justify-center text-xs font-semibold`}>
        {initials || "?"}
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={authorName}
      referrerPolicy="no-referrer"
      onError={() => setErrored(true)}
      className={className}
    />
  )
}
