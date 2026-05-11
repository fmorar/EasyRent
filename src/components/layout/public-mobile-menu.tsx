"use client"

import Link from "next/link"
import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet"
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  BuildingOffice2Icon,
  ArrowRightOnRectangleIcon,
  HomeModernIcon,
  NewspaperIcon,
} from "@heroicons/react/24/outline"

export type PublicProjectLink = { slug: string; title: string }

interface Props {
  marketplaceLabel: string
  /** Label for the sign-in / dashboard link in the drawer footer.
   *  Header passes `Dashboard` when there's an active session. */
  signInLabel:      string
  /** href for the same link — `/login` when signed-out, `/dashboard`
   *  when signed-in. */
  signInHref?:      string
  projects:         PublicProjectLink[]
}

/**
 * Hamburger drawer for public pages on mobile widths.
 * The locale switcher and the desktop nav stay outside (in the header).
 */
export function PublicMobileMenu({
  marketplaceLabel,
  signInLabel,
  signInHref = "/login",
  projects,
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={
        <button
          type="button"
          aria-label="Abrir menú"
          className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border bg-background hover:bg-muted transition-colors duration-(--duration-state) ease-(--ease-out-quart)"
        >
          <Bars3Icon className="h-5 w-5" />
        </button>
      } />

      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full sm:max-w-sm p-0 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-16 border-b">
          <SheetTitle className="text-base font-heading font-semibold tracking-tight">
            Menú
          </SheetTitle>
          <SheetClose render={
            <button
              type="button"
              aria-label="Cerrar"
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          } />
        </div>

        {/* Body */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <DrawerLink
            href="/marketplace"
            icon={<HomeIcon className="h-5 w-5" />}
            label={marketplaceLabel}
            onClick={() => setOpen(false)}
          />

          {projects.length > 0 && (
            <div className="pt-4">
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Proyectos
              </p>
              {projects.map((p) => (
                <DrawerLink
                  key={p.slug}
                  href={`/projects/${p.slug}`}
                  icon={<BuildingOffice2Icon className="h-5 w-5" />}
                  label={p.title}
                  onClick={() => setOpen(false)}
                />
              ))}
            </div>
          )}

          <div className="pt-4 space-y-1">
            <DrawerLink
              href="/blog"
              icon={<NewspaperIcon className="h-5 w-5" />}
              label="Blog"
              onClick={() => setOpen(false)}
            />
            {/* Owner-intake link — visible to every visitor so an owner
                browsing the marketplace on their phone can flip from
                "explorando" to "quiero vender" in one tap. */}
            <DrawerLink
              href="/contacto"
              icon={<HomeModernIcon className="h-5 w-5" />}
              label="Vendé o alquilá tu propiedad"
              onClick={() => setOpen(false)}
            />
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t px-3 py-3">
          <DrawerLink
            href={signInHref}
            icon={<ArrowRightOnRectangleIcon className="h-5 w-5" />}
            label={signInLabel}
            onClick={() => setOpen(false)}
            primary
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── Subcomponent ──────────────────────────────────────────────────
function DrawerLink({
  href, icon, label, onClick, primary,
}: {
  href:     string
  icon:     React.ReactNode
  label:    string
  onClick?: () => void
  primary?: boolean
}) {
  const base =
    "flex items-center gap-3 px-3 h-11 rounded-lg text-sm font-medium transition-colors"
  const cls = primary
    ? `${base} bg-foreground text-background hover:bg-foreground/90`
    : `${base} text-foreground hover:bg-muted`

  return (
    <Link href={href} onClick={onClick} className={cls}>
      <span className="text-muted-foreground">{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  )
}
