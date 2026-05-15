"use client"

import { useTranslations } from "next-intl"
import { Link, usePathname } from "@/i18n/navigation"
import {
  ChevronDownIcon,
  LockClosedIcon,
  ArrowRightIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline"
import { LocaleSwitcher } from "@/components/layout/locale-switcher"
import { PublicMobileMenu } from "@/components/layout/public-mobile-menu"
import { EasyrentLogo } from "@/components/shared/easyrent-logo"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export type PublicProjectLink = { slug: string; title: string }

interface Props {
  projects: PublicProjectLink[]
  /** Whether the visitor has an active session. Drives the right-rail
   *  link copy: signed-out → "Iniciar sesión"; signed-in → "Dashboard". */
  isSignedIn?: boolean
}

/**
 * Public header — editorial register.
 *
 *   ┌────────┐ ┌──────────────────────┐ ┌─────────────────────┐
 *   │ Brand  │ │ ┌───┐                │ │ ES/EN · Login · CTA │
 *   │        │ │ │ ● │ Inicio · M · P │ │                     │
 *   └────────┘ └──────────────────────┘ └─────────────────────┘
 *      left            center pill              right
 *
 * Per the surface-register rule (see `globals.css`): public uses
 * editorial freedom, so the primary CTA is an INK pill (not yellow)
 * and the active nav state is a white card-pill nested inside a
 * muted pill — both are public-only patterns. Dashboard surfaces
 * keep their yellow primary scheme.
 */
export function PublicHeader({ projects, isSignedIn = false }: Props) {
  const t        = useTranslations("nav")
  const pathname = usePathname()

  // Active matchers — kept simple. A pathname like "/marketplace/x" still
  // counts as marketplace; "/projects/foo" still counts as projects.
  const isHome     = pathname === "/" || pathname === ""
  const isProjects = pathname.startsWith("/projects")
  const isContact  = pathname.startsWith("/contacto")
  const isBlog     = pathname.startsWith("/blog")

  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70 border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* ── Brand ───────────────────────────────────────────────── */}
        <Link
          href="/"
          className="flex items-center shrink-0 group transition-opacity duration-(--duration-state) ease-(--ease-out-quart) hover:opacity-80"
          aria-label={t("brandHomeAriaLabel")}
        >
          <EasyrentLogo className="h-7 w-auto text-foreground" />
        </Link>

        {/* ── Center pill nav (md+) ───────────────────────────────── */}
        <nav
          aria-label={t("primaryNavAriaLabel")}
          className="hidden md:flex items-center bg-muted rounded-full p-1 gap-0.5"
        >
          <PillLink
            href="/"
            active={isHome}
          >
            {t("home")}
          </PillLink>
          {/* The "Marketplace" pill used to live here. We removed it
              because the "Explorar propiedades" CTA on the right
              already routes to /marketplace — having both was a
              redundant choice for the visitor. */}
          {projects.length === 1 && (
            <PillLink
              href={`/projects/${projects[0].slug}`}
              active={isProjects}
            >
              {t("projects")}
            </PillLink>
          )}
          {projects.length >= 2 && (
            <PillProjectsMenu projects={projects} active={isProjects} label={t("projects")} />
          )}
          <PillLink
            href="/blog"
            active={isBlog}
          >
            {t("blog")}
          </PillLink>
          {/* Owner-intake CTA — same pill register so it reads as
              navigation, not a marketing button. */}
          <PillLink
            href="/contacto"
            active={isContact}
          >
            {t("sellOrRentShort")}
          </PillLink>
        </nav>

        {/* ── Right cluster ───────────────────────────────────────── */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <LocaleSwitcher />

          {/* Auth link — `Iniciar sesión` when signed-out, `Dashboard`
              when there's an active session. Same visual slot. */}
          <Link
            href={isSignedIn ? "/dashboard" : "/login"}
            className="hidden md:inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-(--duration-state) ease-(--ease-out-quart)"
          >
            {isSignedIn ? (
              <>
                <Squares2X2Icon className="h-4 w-4" />
                {t("dashboard")}
              </>
            ) : (
              <>
                <LockClosedIcon className="h-4 w-4" />
                {t("signIn")}
              </>
            )}
          </Link>

          {/* Primary public CTA — INK pill (not yellow). Sends visitors
              to the marketplace search; the editorial "Discover" tone
              from the new public-surface freedom rule. */}
          <Link
            href="/marketplace"
            className="hidden lg:inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors duration-(--duration-state) ease-(--ease-out-quart)"
          >
            {t("explorePropertiesCta")}
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>

          {/* Mobile sheet trigger lives inside the existing component */}
          <PublicMobileMenu
            marketplaceLabel={t("marketplace")}
            signInLabel={isSignedIn ? t("dashboard") : t("signIn")}
            signInHref={isSignedIn ? "/dashboard" : "/login"}
            projects={projects}
          />
        </div>
      </div>
    </header>
  )
}

// ── Sub-components ────────────────────────────────────────────────

function PillLink({
  href, active, icon, children,
}: {
  href:     string
  active:   boolean
  icon?:    React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap",
        "transition-all duration-(--duration-state) ease-(--ease-out-quart)",
        active
          ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/5"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </Link>
  )
}

function PillProjectsMenu({
  projects, active, label,
}: {
  projects: PublicProjectLink[]
  active:   boolean
  label:    string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap outline-none",
              "transition-all duration-(--duration-state) ease-(--ease-out-quart)",
              active
                ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/5"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            <ChevronDownIcon className="h-3.5 w-3.5" />
          </button>
        }
      />
      <DropdownMenuContent align="center" className="min-w-56">
        {projects.map((p) => (
          <DropdownMenuItem
            key={p.slug}
            render={
              <Link href={`/projects/${p.slug}`} className="cursor-pointer">
                {p.title}
              </Link>
            }
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
