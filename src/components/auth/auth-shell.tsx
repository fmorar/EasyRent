import Link from "next/link"
import {
  ArrowLeftIcon,
  HomeIcon,
} from "@heroicons/react/24/outline"
import { EasyrentLogo } from "@/components/shared/easyrent-logo"
import { AuthFeatureShowcase } from "@/components/auth/auth-feature-showcase"

interface Props {
  /** Kept for backwards compatibility — the right-side showcase no
   *  longer uses a hero photo, so this prop is ignored. Callers can
   *  safely keep passing it; we'll remove the prop after migrating
   *  every page. */
  heroImageUrl?: string | null
  /** The form / content panel rendered on the LEFT side. Keep it
   *  focused — single H1 + form + small footer note. */
  children:     React.ReactNode
  /** Optional override for the back-link label. */
  backLabel?:   string
}

/**
 * Shared split-screen shell for `/login`, `/login/forgot`, `/login/reset`.
 *
 *   ┌──────────── lg+ ────────────┐
 *   │ Form panel     │ Showcase   │
 *   │ (white bg)     │ (tinted +  │
 *   │ Brand top      │ animated   │
 *   │                │ mockups)   │
 *   └────────────────┴────────────┘
 *
 * On mobile the showcase is hidden; the form takes the whole viewport
 * and shows a compact brand pill at the top.
 *
 * The orientation is form-LEFT, showcase-RIGHT to match the
 * reference design (Aivox login). Previous versions of this shell
 * had it flipped — callers don't need to change anything.
 */
export function AuthShell({ children, backLabel = "Volver al inicio" }: Props) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* ── LEFT · form panel ──────────────────────────────────── */}
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

        <div className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto">
          {/* Brand wordmark — inside the centered cluster so the
              column reads as one balanced vertical group. */}
          <div className="hidden lg:flex items-center gap-3 mb-(--spacing-section)">
            <span className="h-10 w-10 rounded-xl bg-foreground text-background flex items-center justify-center">
              <HomeIcon className="h-5 w-5" />
            </span>
            <EasyrentLogo className="h-5 w-auto text-foreground" />
          </div>

          {children}
        </div>
      </main>

      {/* ── RIGHT · animated showcase (hidden < lg) ────────────── */}
      <aside
        className="relative hidden lg:block isolate overflow-hidden"
        aria-hidden
      >
        <AuthFeatureShowcase />
      </aside>
    </div>
  )
}
