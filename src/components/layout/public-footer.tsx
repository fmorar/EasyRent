import Link from "next/link"
import Image from "next/image"
import { NewsletterForm } from "@/components/layout/newsletter-form"
import { EasyrentLogo } from "@/components/shared/easyrent-logo"

interface FooterLink {
  label: string
  href:  string
  /** Set when the link points outside the app (open in new tab). */
  external?: boolean
}

const COMPANY: FooterLink[] = [
  { label: "Inicio",                       href: "/" },
  { label: "Marketplace",                  href: "/marketplace" },
  { label: "Asesores",                     href: "/agents" },
  { label: "Blog",                         href: "/blog" },
  { label: "Vendé o alquilá tu propiedad", href: "/contacto" },
]

const RESOURCES: FooterLink[] = [
  { label: "Comprar propiedad",  href: "/marketplace?op=sale" },
  { label: "Alquilar propiedad", href: "/marketplace?op=rent" },
  { label: "Iniciar sesión",     href: "/login" },
]

const SOCIAL: FooterLink[] = [
  { label: "Instagram", href: "https://instagram.com",      external: true },
  { label: "Facebook",  href: "https://facebook.com",       external: true },
  { label: "WhatsApp",  href: "https://wa.me/50600000000",  external: true },
]

interface PublicFooterProps {
  /** Optional architectural photo URL shown BEHIND the giant wordmark.
   *  When provided, the wordmark renders as a knock-out — the letters
   *  are transparent and reveal the photo, while the surrounding fill
   *  is the editorial blue. Falls back to a solid editorial band when
   *  no photo is available. */
  wordmarkPhotoUrl?: string | null
}

/**
 * Public-surface footer. Three concentric rows:
 *
 *   1. Newsletter band: signup left + 3 link columns right
 *   2. Giant brand wordmark — knock-out treatment over a project photo
 *   3. Legal disclaimer + copyright (small print)
 *
 * Only used on `(public)` routes. Dashboard surfaces use the sidebar
 * shell and don't need this.
 */
export function PublicFooter({ wordmarkPhotoUrl = null }: PublicFooterProps = {}) {
  const year = new Date().getFullYear()

  return (
    <footer className="relative overflow-hidden bg-background border-t" aria-label="Pie de página">
      {/* ── Top: newsletter + link columns ─────────────────────────
              Bottom padding is intentionally tight — the wordmark
              band below already has its own breathing room from the
              fade-into-bg effect. */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-(--spacing-major) pb-(--spacing-cluster) sm:pb-(--spacing-block)">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-(--spacing-section) lg:gap-(--spacing-major)">
          {/* Newsletter — left rail */}
          <div className="lg:col-span-5 space-y-(--spacing-block)">
            <div className="space-y-(--spacing-tight)">
              <h2
                className="font-heading font-bold tracking-tight leading-[1.05] text-foreground"
                style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)" }}
              >
                Suscribite al boletín
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
                Recibí novedades del mercado, propiedades nuevas y consejos para tomar decisiones con datos verificados.
              </p>
            </div>
            <NewsletterForm />
          </div>

          {/* Three link columns — right rail */}
          <nav
            aria-label="Enlaces del pie"
            className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-(--spacing-block) lg:gap-(--spacing-section) lg:pl-(--spacing-section)"
          >
            <FooterColumn heading="Empresa" links={COMPANY} />
            <FooterColumn heading="Recursos" links={RESOURCES} />
            <FooterColumn heading="Redes sociales" links={SOCIAL} />
          </nav>
        </div>
      </div>

      {/* ── Middle: giant brand wordmark — knock-out over photo ───── */}
      <WordmarkKnockout photoUrl={wordmarkPhotoUrl} />

      {/* ── Bottom: legal/copyright row ──────────────────────────── */}
      <div className="border-t bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-(--spacing-cluster) flex flex-col sm:flex-row items-center justify-between gap-(--spacing-tight) text-[11px] text-muted-foreground">
          <p className="font-numeric inline-flex items-center gap-1.5">
            © {year}
            <EasyrentLogo className="h-3 w-auto text-muted-foreground" />
            · Costa Rica
          </p>
          <p className="leading-relaxed text-center sm:text-right max-w-md">
            Las publicaciones tienen carácter informativo. Verificá siempre la documentación registral antes de firmar contrato.
          </p>
        </div>
      </div>
    </footer>
  )
}

// ── Giant brand wordmark with fade-into-bg effect ─────────────────

/**
 * Full-bleed architectural photo at the bottom; giant WHITE wordmark
 * positioned so its TOP HALF rises above the photo into the page bg.
 * Text color = page-bg color → the upper portion blends into the
 * background and visually "fades", while the lower portion remains
 * visible against the photo.
 *
 *                       e a s y r e n t           ← top half on
 *   ╔════════════════ photo ═════════════════╗      page bg (invisible
 *   ║              e a s y r e n t           ║      = blends in)
 *   ║                                        ║
 *   ╚════════════════════════════════════════╝     ← bottom half on
 *                                                    photo (visible)
 */
function WordmarkKnockout({ photoUrl }: { photoUrl: string | null }) {
  return (
    <div
      className="relative w-full overflow-hidden pointer-events-none select-none"
      aria-hidden
    >
      <div className="relative h-[22vw] min-h-[200px]">
        {/* Photo — full bleed, anchored at the bottom, ~72% of band
            height. The slim sliver ABOVE it inherits the page bg —
            just enough room for the text fade illusion. The top edge
            of the photo dissolves into the page bg via a gradient
            overlay (same pattern as the agent cover photo), so there's
            no hard horizontal cut between bg and photo. */}
        <div className="absolute inset-x-0 bottom-0 h-[72%]">
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt=""
              fill
              // Below the fold (page footer) — no priority, lazy load
              // is the default. The optimizer also serves WebP and
              // caches with max-age=31536000, immutable.
              sizes="100vw"
              className="object-cover"
            />
          ) : (
            <div className="h-full w-full bg-foreground" />
          )}
          {/* Top-edge fade — bg-color at the top, fading to transparent
              as you go down, so the photo's upper edge melts into the
              surrounding page background. */}
          <div className="absolute inset-x-0 top-0 h-16 sm:h-20 lg:h-28 bg-gradient-to-b from-background to-transparent pointer-events-none" />
        </div>

        {/* Wordmark in the page-bg color, anchored to the bottom and
            centered. Width is sized so the SVG height (driven by its
            ~3.26:1 aspect ratio) makes the top portion rise into the
            page-bg area above the photo — where the bg-colored logo
            visually disappears against the matching bg, giving the
            "rises out of the photo" illusion the original text
            wordmark had. */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[88%] max-w-[88rem]">
          <EasyrentLogo
            className="block w-full h-auto text-background"
            aria-hidden
          />
        </div>
        <span className="sr-only">easyrent</span>
      </div>
    </div>
  )
}

// ── Column ────────────────────────────────────────────────────────

function FooterColumn({
  heading, links,
}: {
  heading: string
  links:   FooterLink[]
}) {
  return (
    <div className="space-y-(--spacing-cluster)">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
        {heading}
      </p>
      <ul className="space-y-(--spacing-tight)">
        {links.map((l) => (
          <li key={l.label}>
            {l.external ? (
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-foreground/80 hover:text-foreground hover:underline underline-offset-4 decoration-primary decoration-2 transition-colors duration-(--duration-state) ease-(--ease-out-quart)"
              >
                {l.label}
              </a>
            ) : (
              <Link
                href={l.href}
                className="text-sm text-foreground/80 hover:text-foreground hover:underline underline-offset-4 decoration-primary decoration-2 transition-colors duration-(--duration-state) ease-(--ease-out-quart)"
              >
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
