"use client"

/**
 * Heavy half of `<LightboxProvider>` — the modal portal that uses
 * `motion/react` for spring-physics drag. Carved out so the eager
 * Provider can lazy-load this only when a photo is actually clicked,
 * shedding ~85 KiB of motion + supporting code from initial page JS.
 *
 * Loaded via `next/dynamic({ ssr: false })` because:
 *   1. The modal touches `document.body` for portal rendering
 *   2. motion's animation primitives skip SSR anyway
 *   3. There's no SEO benefit — the photos are already in the gallery
 */

import { useCallback, useEffect } from "react"
import { createPortal } from "react-dom"
import { motion, type PanInfo } from "motion/react"
import {
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline"
import type { LightboxPhoto } from "./lightbox"

interface Props {
  idx:     number
  photos:  LightboxPhoto[]
  onClose: () => void
  onPrev:  () => void
  onNext:  () => void
}

export default function LightboxModal({
  idx, photos, onClose, onPrev, onNext,
}: Props) {
  const close = useCallback(() => onClose(), [onClose])
  const prev  = useCallback(() => onPrev(),  [onPrev])
  const next  = useCallback(() => onNext(),  [onNext])

  // Keyboard nav + body scroll lock — only active while the modal is
  // mounted, which is exactly when it's open.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape")     close()
      if (e.key === "ArrowLeft")  prev()
      if (e.key === "ArrowRight") next()
    }
    window.addEventListener("keydown", handler)
    const prevHtmlOverflow = document.documentElement.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = "hidden"
    document.body.style.overflow            = "hidden"
    return () => {
      window.removeEventListener("keydown", handler)
      document.documentElement.style.overflow = prevHtmlOverflow
      document.body.style.overflow            = prevBodyOverflow
    }
  }, [close, prev, next])

  const current = photos[idx]
  if (!current) return null

  return createPortal(
    <div
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

      {/* Image — spring-physics drag */}
      <motion.img
        key={current.url}
        src={current.url}
        alt={current.caption ?? ""}
        className="max-w-[94vw] max-h-[88vh] object-contain select-none touch-none"
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        drag
        dragElastic={0.18}
        dragMomentum={false}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 280, damping: 30, mass: 0.8 }}
        onDragEnd={(_e, info: PanInfo) => {
          const SWIPE_X = 120
          const SWIPE_Y = 180
          const FLICK   = 600
          if (info.offset.y > SWIPE_Y || info.velocity.y > FLICK) { close(); return }
          if (info.offset.x < -SWIPE_X || info.velocity.x < -FLICK) { next();  return }
          if (info.offset.x > SWIPE_X  || info.velocity.x > FLICK)  { prev();  return }
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
    </div>,
    document.body,
  )
}
