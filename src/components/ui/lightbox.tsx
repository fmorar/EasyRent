"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import dynamic from "next/dynamic"

export type LightboxPhoto = {
  url:      string
  caption?: string | null
}

interface LightboxContextValue {
  open:    (index: number) => void
  photos:  LightboxPhoto[]
}

const LightboxContext = createContext<LightboxContextValue | null>(null)

interface ProviderProps {
  photos:   LightboxPhoto[]
  children: ReactNode
}

// The heavy modal (motion/react + portal) is loaded only when the user
// actually opens the lightbox. Saves ~85 KiB of motion-related JS from
// the property page's initial bundle. ssr:false because the modal
// touches document.body for portal rendering and there's nothing to
// SEO-render anyway (the photos are already in the gallery markup).
const LightboxModal = dynamic(() => import("./lightbox-modal"), {
  ssr: false,
})

/**
 * Wrap a gallery (or any region with photo triggers) with this provider
 * so descendants can open a fullscreen lightbox.
 *
 * Usage:
 *   <LightboxProvider photos={photos}>
 *     <LightboxTrigger index={0}>
 *       <img src="…" />
 *     </LightboxTrigger>
 *   </LightboxProvider>
 *
 * The Provider itself is lightweight — it just owns the open/close
 * state. The actual modal (which pulls in `motion/react`) is dynamic-
 * imported and mounted only while open. That keeps initial page JS
 * for the property and project pages lean while preserving all the
 * spring-physics drag interactions when the user actually uses it.
 */
export function LightboxProvider({ photos, children }: ProviderProps) {
  const [idx, setIdx] = useState<number | null>(null)

  const close = useCallback(() => setIdx(null), [])
  const prev  = useCallback(
    () => setIdx((i) => (i === null ? null : (i - 1 + photos.length) % photos.length)),
    [photos.length],
  )
  const next  = useCallback(
    () => setIdx((i) => (i === null ? null : (i + 1) % photos.length)),
    [photos.length],
  )

  return (
    <LightboxContext.Provider value={{ open: setIdx, photos }}>
      {children}
      {idx !== null && (
        <LightboxModal
          idx={idx}
          photos={photos}
          onClose={close}
          onPrev={prev}
          onNext={next}
        />
      )}
    </LightboxContext.Provider>
  )
}

interface TriggerProps {
  index:      number
  className?: string
  children:   ReactNode
}

export function LightboxTrigger({ index, className, children }: TriggerProps) {
  const ctx = useContext(LightboxContext)
  if (!ctx) {
    // Fail soft: render children unwrapped if no provider.
    return <>{children}</>
  }
  return (
    <button
      type="button"
      onClick={() => ctx.open(index)}
      className={className}
      aria-label="Ampliar foto"
    >
      {children}
    </button>
  )
}
