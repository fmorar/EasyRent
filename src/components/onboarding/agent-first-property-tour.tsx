"use client"

import { useEffect, useRef } from "react"
import { Onborda, OnbordaProvider, useOnborda, type Step } from "onborda"
import { markTourCompleted } from "@/lib/actions/onboarding.actions"

/**
 * Five-step welcome tour that walks a new agent (or owner_admin) from
 * the dashboard to "publish your first property". The host pages
 * already tag their key elements with `data-tour="…"` attributes so
 * the selectors stay stable through markup tweaks.
 *
 * Run-once: `shouldRun` is `true` only when `profiles.tour_completed_at`
 * is NULL for the viewer. On finish or skip we call the server action
 * `markTourCompleted` which stamps the column so it never auto-launches
 * again.
 */

const STEPS: Step[] = [
  {
    icon: "👋",
    title: "Bienvenido a easyrent",
    content: (
      <p className="text-sm">
        Te muestro cómo subir tu primera propiedad. Son 4 pasos cortos —
        podés saltarlo cuando quieras.
      </p>
    ),
    selector: '[data-tour="sidebar-dashboard"]',
    side: "right",
    showControls: true,
    pointerPadding: 8,
    pointerRadius: 10,
  },
  {
    icon: "🏠",
    title: "Tus propiedades",
    content: (
      <p className="text-sm">
        Acá viven todas las propiedades que subís + las que otros agentes
        comparten con vos. Hacé clic en <strong>Propiedades</strong> para
        seguir.
      </p>
    ),
    selector: '[data-tour="sidebar-properties"]',
    side: "right",
    showControls: true,
    pointerPadding: 8,
    pointerRadius: 10,
    nextRoute: "/properties",
  },
  {
    icon: "✨",
    title: "Nueva propiedad",
    content: (
      <p className="text-sm">
        Tocá <strong>Agregar propiedad</strong> para abrir el formulario
        con todos los campos.
      </p>
    ),
    selector: '[data-tour="new-property-cta"]',
    side: "left",
    showControls: true,
    pointerPadding: 8,
    pointerRadius: 10,
    nextRoute: "/properties/new",
  },
  {
    icon: "📝",
    title: "Empezá por el título",
    content: (
      <p className="text-sm">
        Un buen título incluye el tipo + zona + un diferenciador concreto.
        Ej: <em>&quot;Casa de 4 hab. en Escazú con patio&quot;</em>.
      </p>
    ),
    selector: '#title',
    side: "bottom",
    showControls: true,
    pointerPadding: 8,
    pointerRadius: 8,
  },
  {
    icon: "💾",
    title: "Guardá cuando termines",
    content: (
      <p className="text-sm">
        Llená los campos requeridos, agregá fotos y dale <strong>Guardar</strong>.
        Una vez publicada vas a poder compartirla con tu red.
      </p>
    ),
    selector: '[data-tour="save-form"]',
    side: "bottom",
    showControls: true,
    pointerPadding: 8,
    pointerRadius: 8,
  },
]

const TOUR_NAME = "agent-first-property"

interface Props {
  shouldRun: boolean
  children:  React.ReactNode
}

export function AgentFirstPropertyTour({ shouldRun, children }: Props) {
  return (
    <OnbordaProvider>
      <Onborda
        steps={[{ tour: TOUR_NAME, steps: STEPS }]}
        showOnborda
        shadowOpacity="0.6"
      >
        {/* Inner component uses the useOnborda hook to auto-start. */}
        <AutoStart shouldRun={shouldRun} />
        {children}
      </Onborda>
    </OnbordaProvider>
  )
}

function AutoStart({ shouldRun }: { shouldRun: boolean }) {
  const { startOnborda, currentTour } = useOnborda()
  const startedRef = useRef(false)
  const markedRef  = useRef(false)

  // Kick off the tour on mount when the viewer hasn't seen it yet.
  useEffect(() => {
    if (!shouldRun || startedRef.current) return
    const t = window.setTimeout(() => {
      startOnborda(TOUR_NAME)
      startedRef.current = true
    }, 400)
    return () => window.clearTimeout(t)
    // Run once on mount. shouldRun only changes on remount with fresh
    // server data, and startOnborda is stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRun])

  // Stamp the DB the moment the tour closes (finished or dismissed).
  // We only do this once, and only after we actually started the tour
  // — guards against firing on the initial null state.
  useEffect(() => {
    if (!startedRef.current || markedRef.current) return
    if (currentTour !== null) return
    markedRef.current = true
    void markTourCompleted()
  }, [currentTour])

  return null
}
