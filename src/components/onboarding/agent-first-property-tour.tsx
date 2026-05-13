"use client"

import { useEffect, useRef, useMemo } from "react"
import { useLocale } from "next-intl"
import {
  Onborda, OnbordaProvider, useOnborda,
  type Step, type CardComponentProps,
} from "onborda"
import { Button } from "@/components/ui/button"
import { XMarkIcon } from "@heroicons/react/24/outline"
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

// Steps are built per-locale at render time so the nextRoute paths
// include the locale prefix. Onborda calls router.push() from
// next/navigation (not next-intl), so without the prefix the
// middleware would have to redirect, which kills the click-to-advance
// flow.
function buildSteps(locale: string): Step[] {
  return [
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
      nextRoute: `/${locale}/properties`,
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
      nextRoute: `/${locale}/properties/new`,
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
      // bottom-right: the Guardar button sits flush with the right edge,
      // so "bottom" overflows the viewport and triggers horizontal scroll.
      // Anchoring to the right keeps the card inside.
      side: "bottom-right",
      showControls: true,
      pointerPadding: 8,
      pointerRadius: 8,
    },
  ]
}

const TOUR_NAME = "agent-first-property"

interface Props {
  shouldRun: boolean
  children:  React.ReactNode
}

export function AgentFirstPropertyTour({ shouldRun, children }: Props) {
  const locale = useLocale()
  const steps  = useMemo(() => buildSteps(locale), [locale])

  return (
    <OnbordaProvider>
      <Onborda
        steps={[{ tour: TOUR_NAME, steps }]}
        showOnborda
        shadowOpacity="0.6"
        cardComponent={TourCard}
      >
        {/* Inner component uses the useOnborda hook to auto-start. */}
        <AutoStart shouldRun={shouldRun} />
        {children}
      </Onborda>
    </OnbordaProvider>
  )
}

/**
 * Branded card. Onborda doesn't ship a default card — without a
 * cardComponent the whole tour renders nothing, which is what was
 * breaking the first-property flow. This component is the visible
 * surface: icon + title + content + progress + controls + arrow.
 */
function TourCard({
  step, currentStep, totalSteps, nextStep, prevStep, arrow,
}: CardComponentProps) {
  const { closeOnborda } = useOnborda()
  const isFirst = currentStep === 0
  const isLast  = currentStep === totalSteps - 1

  return (
    <div className="w-[320px] rounded-2xl bg-card border shadow-2xl p-5 text-foreground">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {step.icon && (
            <span className="text-2xl leading-none shrink-0">{step.icon}</span>
          )}
          <h3 className="text-base font-heading font-semibold leading-tight truncate">
            {step.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={closeOnborda}
          className="shrink-0 -m-1 p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
          aria-label="Saltar tour"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="text-sm text-muted-foreground leading-relaxed mb-4">
        {step.content}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground font-numeric tabular-nums">
          {currentStep + 1} / {totalSteps}
        </span>
        <div className="flex items-center gap-2">
          {!isFirst && (
            <Button type="button" size="sm" variant="outline" onClick={prevStep}>
              Atrás
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={isLast ? closeOnborda : nextStep}
          >
            {isLast ? "Listo" : "Siguiente"}
          </Button>
        </div>
      </div>

      {/* Arrow is an SVG using fill="currentColor" — text-card makes it
          match the card's bg so it reads as a continuation of the card. */}
      <span className="text-card">{arrow}</span>
    </div>
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
