import Link from "next/link"
import {
  ArrowLeftIcon,
  HomeIcon,
} from "@heroicons/react/24/outline"
import { EasyrentLogo } from "@/components/shared/easyrent-logo"

interface Props {
  /** URL of the placeholder hero photo. Server passes this in from
   *  the most recent marketplace cover; null falls back to a gradient. */
  heroImageUrl: string | null
  /** The form / content panel rendered on the right side. Keep it
   *  focused — single H1 + form + small footer note. */
  children:     React.ReactNode
  /** Optional override for the back-link label. */
  backLabel?:   string
}

/**
 * Shared split-screen shell for `/login`, `/login/forgot`, `/login/reset`.
 *
 *   ┌──────────── lg+ ────────────┐
 *   │ Hero photo (dark)  │ Form    │
 *   │ Brand top-left     │ panel   │
 *   │ Tagline bottom     │         │
 *   └────────────────────┴─────────┘
 *
 * On mobile the hero side is hidden; the form panel takes the whole
 * viewport and shows a compact mobile brand pill in the top-right.
 */
export function AuthShell({ heroImageUrl, children, backLabel = "Volver al inicio" }: Props) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* ── LEFT · hero photo (hidden < lg) ─────────────────────── */}
      <aside
        className="relative isolate overflow-hidden hidden lg:block"
        aria-hidden
      >
        <div className="absolute inset-0 -z-10">
          {heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-hero-fallback" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/70" />
        </div>

        {/* Top — brand */}
        <div className="absolute top-8 left-8 right-8 flex items-center gap-3 z-10">
          <span className="h-10 w-10 rounded-full bg-white/95 ring-2 ring-white/30 flex items-center justify-center shadow-sm shrink-0">
            <HomeIcon className="h-5 w-5 text-foreground" />
          </span>
          <EasyrentLogo className="h-5 w-auto text-white" />
        </div>

        {/* Bottom — tagline cluster */}
        <div className="absolute bottom-10 sm:bottom-14 left-8 sm:left-12 right-8 sm:right-12 space-y-3 z-10">
          <h2 className="text-3xl xl:text-4xl font-heading font-bold leading-tight text-white">
            Encontrá tu próximo hogar
          </h2>
          <p className="text-sm text-white/80 max-w-md leading-relaxed">
            Coordiná visitas en pocos clicks. Documentación verificada antes de cada cita.
          </p>
          <div className="flex items-center gap-1.5 pt-(--spacing-tight)">
            <span className="h-1 w-8 rounded-full bg-white" />
            <span className="h-1 w-2 rounded-full bg-white/40" />
            <span className="h-1 w-2 rounded-full bg-white/40" />
          </div>
        </div>
      </aside>

      {/* ── RIGHT · form panel ──────────────────────────────────── */}
      <main className="relative flex flex-col px-6 py-8 sm:px-10 sm:py-10 lg:px-16 lg:py-12 min-h-screen">
        {/* Top row: back link + (mobile-only) brand */}
        <header className="flex items-center justify-between mb-(--spacing-block) lg:mb-(--spacing-section)">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            {backLabel}
          </Link>
          <span className="lg:hidden flex items-center gap-2">
            <span className="h-7 w-7 rounded-full bg-foreground text-background flex items-center justify-center">
              <HomeIcon className="h-3.5 w-3.5" />
            </span>
            <EasyrentLogo className="h-3.5 w-auto text-foreground" />
          </span>
        </header>

        <div className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto lg:mx-0">
          {children}
        </div>
      </main>
    </div>
  )
}
