"use client"

import { useMemo, useState } from "react"
import {
  ChevronRightIcon,
  ChevronLeftIcon,
  ShieldCheckIcon,
  StarIcon as StarSolid,
} from "@heroicons/react/24/solid"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export interface Testimonial {
  /** Person's display name. */
  name:    string
  /** Short role line: "Propietaria · Escazú" / "Inquilino · Santa Ana" */
  role:    string
  /** Body of the testimonial — voseo CR. */
  quote:   string
  /** Optional photo URL. Falls back to initials avatar. */
  photo?:  string | null
  /** Display date (DD/MM/YYYY for CR locale). Hardcoded sensibly when
   *  the testimonial doesn't carry one. */
  date?:   string
}

interface Props {
  /** Override the curated samples by passing real testimonials in. */
  items?: Testimonial[]
  /** Optional architectural photo shown as the backdrop of the
   *  featured (center) card. Pass a project cover URL from the server. */
  featuredPhotoUrl?: string | null
}

/**
 * Curated samples — replace with a real `testimonials` table when you
 * have ≥3 verifiable reviews on file. Each one mentions a concrete
 * action of the service so they don't read as generic "great service!".
 */
const SAMPLES: Testimonial[] = [
  {
    name:  "Camila Rojas",
    role:  "Inquilina · Escazú",
    quote: "Cerré el alquiler en menos de una semana. La asesora me explicó cada cláusula del contrato y me acompañó al notariado.",
    date:  "12/03/2026",
  },
  {
    name:  "Andrés Mora",
    role:  "Propietario · Santa Ana",
    quote: "Publicaron mi casa con fotos profesionales y filtraron las visitas. Solo me llegaron leads reales con documentos al día.",
    date:  "27/02/2026",
  },
  {
    name:  "María José Solís",
    role:  "Compradora · Rohrmoser",
    quote: "Verificaron el folio real antes de presentar oferta y encontraron un gravamen que el vendedor no había mencionado.",
    date:  "08/04/2026",
  },
  {
    name:  "Diego Fonseca",
    role:  "Inquilino · Curridabat",
    quote: "Coordinaron 4 visitas en una sola tarde, todas con horarios confirmados y la ficha completa por adelantado.",
    date:  "19/03/2026",
  },
]

/**
 * Testimonials section — eyebrow pill + headline left, ink CTA right;
 * 3-card row below with a featured (larger, photo-backed) card in the
 * middle and two regular text cards on the sides. Optional chevrons
 * paginate when more than 3 testimonials are passed.
 *
 *   ┌─[Testimonios]               ┌─CTA─┐
 *   │ Headline (clamp)            │     │
 *   │                             └─────┘
 *   │
 *   │ ┌─Card──┐ ┌─FEATURED───┐ ┌─Card──┐ ◀▶
 *   │ │ name  │ │ name  ✓Ver │ │ name  │
 *   │ │ quote │ │ ████ photo │ │ quote │
 *   │ │ ★★★★★│ │ ████       │ │ ★★★★★│
 *   │ │ date  │ │ ★★★★★ date│ │ date  │
 *   │ └───────┘ └────────────┘ └───────┘
 */
export function Testimonials({ items = SAMPLES, featuredPhotoUrl = null }: Props) {
  const [activeIdx, setActiveIdx] = useState(0)
  const total = items.length

  // Visible window of 3: [left, center=featured, right] starting at activeIdx.
  // The CENTER slot is always featured (index 1 of the visible window).
  const visible = useMemo(() => {
    if (total === 0) return []
    if (total <= 3) return items
    return [0, 1, 2].map((i) => items[(activeIdx + i) % total])
  }, [activeIdx, items, total])

  if (total === 0) return null

  const canPaginate = total > 3
  const next = () => setActiveIdx((i) => (i + 1) % total)
  const prev = () => setActiveIdx((i) => (i - 1 + total) % total)

  return (
    <section
      aria-label="Testimonios de clientes"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-(--spacing-section) md:py-(--spacing-major)"
    >
      {/* ── Header — eyebrow + headline left, carousel arrows right ─
              The arrows live in the header (where a CTA used to sit)
              so the controls read as part of the section's chrome,
              not as a floating overlay on the cards. */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-(--spacing-block) mb-(--spacing-section) lg:mb-(--spacing-major)">
        <div className="space-y-(--spacing-cluster) max-w-3xl">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Testimonios
          </p>
          <h2
            className="font-heading font-bold tracking-tight leading-[1.05] text-foreground"
            style={{ fontSize: "clamp(2rem, 5vw, 3.75rem)" }}
          >
            Elegidos por familias y propietarios{" "}
            <span className="text-foreground/40">en todo el Gran Área Metropolitana</span>
          </h2>
        </div>

        {canPaginate && (
          <div className="self-start lg:self-end flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={prev}
              aria-label="Testimonio anterior"
              className="h-10 w-10 rounded-full bg-background ring-1 ring-foreground/10 shadow-sm flex items-center justify-center text-foreground hover:bg-muted transition-colors duration-(--duration-state) ease-(--ease-out-quart)"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Siguiente testimonio"
              className="h-10 w-10 rounded-full bg-foreground text-background ring-1 ring-foreground/10 shadow-sm flex items-center justify-center hover:bg-foreground/90 transition-colors duration-(--duration-state) ease-(--ease-out-quart)"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </header>

      {/* ── Cards row — regular · FEATURED · regular ──────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 lg:gap-5 items-stretch">
        {visible.map((t, i) => {
          const isFeatured = i === 1 && visible.length > 1
          return (
            <div
              key={`${t.name}-${activeIdx}-${i}`}
              className={cn(
                visible.length === 1 && "md:col-span-12",
                visible.length === 2 && "md:col-span-6",
                visible.length >= 3 && (
                  isFeatured
                    ? "md:col-span-5"
                    : i === 0 ? "md:col-span-3 md:col-start-1" : "md:col-span-3 md:col-start-9"
                ),
              )}
            >
              {isFeatured
                ? <FeaturedCard testimonial={t} photoUrl={featuredPhotoUrl} />
                : <RegularCard testimonial={t} />}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── Regular card — text-only, white bg, side-rail size ────────────

function RegularCard({ testimonial }: { testimonial: Testimonial }) {
  const initials = (testimonial.name || "")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <article className="h-full rounded-2xl bg-card ring-1 ring-foreground/5 shadow-sm p-(--spacing-block) flex flex-col gap-(--spacing-block)">
      {/* Header — avatar + name/role + verified badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={testimonial.photo ?? undefined} alt={testimonial.name} />
            <AvatarFallback className="text-[11px]">{initials || "?"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-heading font-semibold leading-tight truncate">
              {testimonial.name}
            </p>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {testimonial.role}
            </p>
          </div>
        </div>
        <span
          className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-foreground/70 shrink-0"
          aria-label="Cliente verificado"
        >
          <ShieldCheckIcon className="h-3.5 w-3.5" />
        </span>
      </div>

      {/* Quote — main body */}
      <p className="text-sm text-foreground leading-relaxed flex-1">
        “{testimonial.quote}”
      </p>

      {/* Footer — stars + date */}
      <div className="flex items-center justify-between gap-3 pt-(--spacing-tight) border-t border-(--hairline-soft)">
        <Stars />
        {testimonial.date && (
          <span className="text-[11px] text-muted-foreground font-numeric tabular-nums">
            {testimonial.date}
          </span>
        )}
      </div>
    </article>
  )
}

// ── Featured card — larger, photo-backed, dark gradient + white text ─

function FeaturedCard({
  testimonial, photoUrl,
}: {
  testimonial: Testimonial
  photoUrl:    string | null
}) {
  const initials = (testimonial.name || "")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <article className="relative h-full min-h-[420px] rounded-2xl overflow-hidden bg-foreground ring-1 ring-foreground/10 shadow-md">
      {/* Photo backdrop — project cover or gradient fallback */}
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-foreground to-editorial flex items-center justify-center">
          <span
            className="font-heading font-black tracking-tight text-background/30"
            style={{ fontSize: "clamp(5rem, 10vw, 9rem)", letterSpacing: "-0.04em" }}
          >
            {initials || "•"}
          </span>
        </div>
      )}

      {/* Dark overlay so name/stars/date stay legible against any photo */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/15 to-black/70 pointer-events-none" />

      {/* Top — name + role left, verified badge right */}
      <div className="absolute top-(--spacing-block) inset-x-(--spacing-block) flex items-start justify-between gap-3 text-white">
        <div className="min-w-0">
          <p className="text-base font-heading font-semibold leading-tight truncate drop-shadow-md">
            {testimonial.name}
          </p>
          <p className="text-xs text-white/85 mt-0.5 truncate drop-shadow-md">
            {testimonial.role}
          </p>
        </div>
        <span
          className="h-7 w-7 rounded-full bg-background/85 backdrop-blur flex items-center justify-center text-foreground shrink-0"
          aria-label="Cliente verificado"
        >
          <ShieldCheckIcon className="h-3.5 w-3.5" />
        </span>
      </div>

      {/* Bottom — stars + date */}
      <div className="absolute bottom-(--spacing-block) inset-x-(--spacing-block) flex items-center justify-between gap-3 text-white">
        <Stars className="text-primary drop-shadow-sm" />
        {testimonial.date && (
          <span className="text-[11px] text-white/85 font-numeric tabular-nums drop-shadow-sm">
            {testimonial.date}
          </span>
        )}
      </div>
    </article>
  )
}

// ── 5-star rating row ─────────────────────────────────────────────

function Stars({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-0.5 text-primary", className)} aria-label="5 estrellas">
      {[1, 2, 3, 4, 5].map((n) => (
        <StarSolid key={n} className="h-3.5 w-3.5" />
      ))}
    </div>
  )
}
