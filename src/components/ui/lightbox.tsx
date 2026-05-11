"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { motion, type PanInfo } from "motion/react"
import {
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline"

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

/**
 * Wrap a gallery (or any region with photo triggers) with this provider so
 * descendants can open a fullscreen lightbox.
 *
 * Usage:
 *   <LightboxProvider photos={photos}>
 *     <LightboxTrigger index={0}>
 *       <img src="…" />
 *     </LightboxTrigger>
 *   </LightboxProvider>
 */
export function LightboxProvider({ photos, children }: ProviderProps) {
  const [idx, setIdx] = useState<number | null>(null)
  // SSR-safe portal target. We can't reference `document` until after
  // hydration, so guard with a `mounted` flag and a `null` body during
  // SSR. Without this we'd get hydration mismatches.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const close = useCallback(() => setIdx(null), [])
  const prev  = useCallback(
    () => setIdx((i) => (i === null ? null : (i - 1 + photos.length) % photos.length)),
    [photos.length],
  )
  const next  = useCallback(
    () => setIdx((i) => (i === null ? null : (i + 1) % photos.length)),
    [photos.length],
  )

  // Keyboard navigation + body scroll lock while open
  useEffect(() => {
    if (idx === null) return
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape")     close()
      if (e.key === "ArrowLeft")  prev()
      if (e.key === "ArrowRight") next()
    }
    window.addEventListener("keydown", handler)
    // Lock both html + body so iOS Safari doesn't rubber-band the page
    // behind the modal. We restore both on close.
    const prevHtmlOverflow = document.documentElement.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = "hidden"
    document.body.style.overflow            = "hidden"
    return () => {
      window.removeEventListener("keydown", handler)
      document.documentElement.style.overflow = prevHtmlOverflow
      document.body.style.overflow            = prevBodyOverflow
    }
  }, [idx, close, prev, next])

  const current = idx !== null ? photos[idx] : null

  // Portal the modal directly under <body>. This guarantees the
  // overlay escapes any ancestor that creates a containing block —
  // transforms (the gallery hero parallax!), `contain`, view-transition
  // snapshots, sticky-header stacking, etc. Without this, `fixed
  // inset-0` is fixed RELATIVE TO THAT ANCESTOR, not the viewport,
  // so the overlay stops short of full vh on certain layouts.
  const overlay = current && idx !== null ? (
    <div
      // `100dvh` is the dynamic viewport height — it shrinks/grows with
      // the mobile URL bar, unlike `100vh`. Combined with `inset-0` as
      // a layout fallback for browsers that don't support `dvh`.
      className="fixed inset-0 w-screen h-[100dvh] z-[200] bg-black/95 flex items-center justify-center animate-in fade-in duration-150 overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-label="Foto ampliada"
      onClick={close}
    >
          {/* Close */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); close() }}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur text-white flex items-center justify-center transition-colors"
            aria-label="Cerrar"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>

          {/* Prev */}
          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); prev() }}
              className="absolute left-3 sm:left-6 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur text-white flex items-center justify-center transition-colors"
              aria-label="Foto anterior"
            >
              <ChevronLeftIcon className="h-6 w-6" />
            </button>
          )}

          {/* Next */}
          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); next() }}
              className="absolute right-3 sm:right-6 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur text-white flex items-center justify-center transition-colors"
              aria-label="Foto siguiente"
            >
              <ChevronRightIcon className="h-6 w-6" />
            </button>
          )}

          {/* Image — spring-physics drag. Drag horizontally to navigate;
              the image follows the finger and snaps to the next/prev
              photo if released past the threshold. Vertical drag past
              threshold dismisses the lightbox (iOS Photos pattern). */}
          <motion.img
            key={current.url}
            src={current.url}
            alt={current.caption ?? ""}
            className="max-w-[94vw] max-h-[88vh] object-contain select-none touch-none"
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            // Free 2-axis drag with elastic resistance.
            drag
            dragElastic={0.18}
            dragMomentum={false}
            // Initial mount: settle in with a calm spring.
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{
              type:    "spring",
              stiffness: 280,
              damping:   30,
              mass:      0.8,
            }}
            onDragEnd={(_e, info: PanInfo) => {
              const SWIPE_X = 120  // px to count as a horizontal swipe
              const SWIPE_Y = 180  // px to count as a vertical dismiss
              const FLICK   = 600  // px/s velocity that bypasses distance
              if (info.offset.y > SWIPE_Y || info.velocity.y > FLICK) {
                close()
                return
              }
              if (info.offset.x < -SWIPE_X || info.velocity.x < -FLICK) {
                next()
                return
              }
              if (info.offset.x > SWIPE_X || info.velocity.x > FLICK) {
                prev()
                return
              }
              // Below threshold — spring snaps back via animate={{x:0,y:0}}.
            }}
          />

          {/* Caption + counter */}
          <div className="absolute bottom-5 inset-x-0 px-6 flex flex-col items-center gap-2 pointer-events-none">
            {current.caption && (
              <p className="text-sm text-white/85 max-w-2xl text-center">
                {current.caption}
              </p>
            )}
            {photos.length > 1 && (
              <p className="text-xs text-white/60 font-numeric">
                {idx + 1} / {photos.length}
              </p>
            )}
          </div>
        </div>
  ) : null

  return (
    <LightboxContext.Provider value={{ open: setIdx, photos }}>
      {children}
      {mounted && overlay !== null && createPortal(overlay, document.body)}
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
    // Fail soft: render children unwrapped if no provider
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
