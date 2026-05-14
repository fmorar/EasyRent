// Public "contacto" — owner-intake landing.
//
// Layout (mirrors the design ref):
//   ┌── outer page bg (muted) ──────────────────────────────┐
//   │  ╔═ rounded card ════════════════════════════════════╗ │
//   │  ║  • • ▪ ▪ ◦ ◦                                       ║ │
//   │  ║  ┌──────────────────┬──────────────────────────┐  ║ │
//   │  ║  │ Headline + lead  │   Form                   │  ║ │
//   │  ║  │ + CTA            │                          │  ║ │
//   │  ║  └──────────────────┴──────────────────────────┘  ║ │
//   │  ║  ── (divider) ─────────────────────────────────    ║ │
//   │  ║  [quote 1]               [quote 2]                 ║ │
//   │  ║  ── (divider) ─────────────────────────────────    ║ │
//   │  ║  [icon · title · body] × 4                          ║ │
//   │  ╚════════════════════════════════════════════════════╝ │
//   │  (PublicFooter)                                          │
//   └──────────────────────────────────────────────────────────┘

import { createClient } from "@/lib/supabase/server"
import { getLocale, getTranslations } from "next-intl/server"
import type { Metadata } from "next"
import { OwnerLeadForm } from "@/components/contact/owner-lead-form"
import { PublicFooter } from "@/components/layout/public-footer"
import { CheckCircleIcon } from "@heroicons/react/24/outline"
import { EnvelopeIcon, PhoneIcon } from "@heroicons/react/24/outline"
import { buildHreflangAlternates } from "@/lib/seo/json-ld"

export const revalidate = 600

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  ?? "https://www.easyrent.house"
)

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const title  = locale === "en"
    ? "List your property · Sell or rent in Costa Rica · easyrent"
    : "Contacto · vendé o alquilá tu propiedad · easyrent"
  const description = locale === "en"
    ? "Connect your property with verified buyers and tenants in Costa Rica. Free valuation, professional marketing, paperwork handled."
    : "Conectamos tu propiedad con compradores e inquilinos verificados en Costa Rica. Valoración sin compromiso, marketing profesional y documentación al día."

  return {
    title,
    description,
    alternates: buildHreflangAlternates({
      path:    "/contacto",
      locale,
      baseUrl: SITE_URL,
    }),
    openGraph: {
      type:        "website",
      title,
      description,
      url:         `${SITE_URL}/${locale}/contacto`,
      siteName:    "easyrent",
      locale:      locale === "en" ? "en_US" : "es_CR",
    },
  }
}

export default async function ContactoPage() {
  const t = await getTranslations("contactOwner")
  const supabase = await createClient()

  // Footer wordmark uses the most recent cover so the bottom of the
  // page reads as part of the rest of the site.
  const { data: cover } = await supabase
    .from("property_photos")
    .select("url")
    .eq("is_cover", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { url: string } | null }

  return (
    <div className="bg-background">
      {/* Outer rhythm:
            • Vertical: explicit `pt-20 sm:pt-24 lg:pt-32` (80/96/128px)
              keeps the centered hero from kissing the public header
              even on mobile — the previous `--spacing-major` (64px)
              looked cramped right under the nav.
            • Horizontal: generous gutters at every breakpoint so
              content never brushes the edge.
            • Section spacing: massive between bands (96px) so the
              divider rows feel intentional. */}
      <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16 xl:px-24 pt-20 sm:pt-24 lg:pt-32 pb-(--spacing-major) space-y-8">

        {/* ── Centered hero ───────────────────────────────────────
                Pattern from the design reference: small eyebrow tag,
                big bold h1, narrower lead — all centered. Keeps the
                visitor's eye anchored before they scan to the form. */}
        <header className="text-center space-y-(--spacing-block) max-w-2xl mx-auto">
          <p className="text-xs uppercase tracking-[0.22em] font-semibold text-foreground">
            {t("eyebrow")}
          </p>
          <h1
            className="font-heading font-bold tracking-tight leading-[1.05] text-foreground"
            style={{ fontSize: "clamp(2.25rem, 4.5vw, 3.75rem)" }}
          >
            {t("heroTitle")}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
            {t("heroLead")}
          </p>
        </header>

        {/* ── Form (left) + Benefits + Contact (right) ──────────── */}
        <div id="cuentanos" className="grid grid-cols-1 lg:grid-cols-2 gap-(--spacing-section) lg:gap-(--spacing-major) items-start">

          {/* Left — form */}
          <div className="min-w-0">
            <OwnerLeadForm />
          </div>

          {/* Right — benefits checklist only. Direct-contact chips
              and the testimonial used to live here too but the page
              read busy with three stacked blocks; the form already
              gives the agent every channel they need to reach us. */}
          <aside className="min-w-0">
            <section className="space-y-(--spacing-block)">
              <h2 className="text-base font-heading font-semibold tracking-tight">
                {t("benefitsHeading")}
              </h2>
              <ul className="space-y-(--spacing-block)">
                <BenefitItem text={t("feat1Title")} body={t("feat1Body")} />
                <BenefitItem text={t("feat2Title")} body={t("feat2Body")} />
                <BenefitItem text={t("feat3Title")} body={t("feat3Body")} />
                <BenefitItem text={t("feat4Title")} body={t("feat4Body")} />
              </ul>
            </section>
          </aside>
        </div>
      </div>

      <PublicFooter wordmarkPhotoUrl={cover?.url ?? null} />
    </div>
  )
}

// ── Pieces ──────────────────────────────────────────────────────

/**
 * One row of the benefits checklist on the right rail. Outlined
 * check icon + title (semibold) + supporting body underneath.
 * Mirrors the "Improve usability / Engage users / …" list in the
 * design reference.
 */
function BenefitItem({
  text, body,
}: {
  text: string
  body: string
}) {
  return (
    <li className="flex items-start gap-(--spacing-cluster)">
      <CheckCircleIcon className="h-5 w-5 shrink-0 text-foreground mt-0.5" />
      <div className="space-y-(--spacing-tight) min-w-0">
        <p className="text-sm font-medium leading-snug text-foreground">{text}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
      </div>
    </li>
  )
}

/**
 * Compact contact tile — icon in a rounded circle + label + value.
 * Renders as a link so phones jump to WhatsApp / dialers and emails
 * open the OS mail client.
 */
function ContactChip({
  icon, label, value, href,
}: {
  icon:  React.ReactNode
  label: string
  value: string
  href:  string
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className="flex items-center gap-(--spacing-cluster) group"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-card text-foreground group-hover:bg-muted transition-colors">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-numeric font-medium truncate group-hover:underline decoration-foreground/30 underline-offset-4">
          {value}
        </p>
      </div>
    </a>
  )
}

/**
 * Single testimonial — avatar initials box on the left, italic body
 * on the right. Used inline in the right rail; the homepage tone is
 * "real client said this", not a sales pitch.
 */
function Quote({
  initials, name, meta, body,
}: {
  initials: string
  name:     string
  meta:     string
  body:     string
}) {
  return (
    <figure className="flex items-start gap-(--spacing-block)">
      <div className="shrink-0 h-12 w-12 rounded-full flex items-center justify-center text-sm font-numeric font-semibold bg-primary text-foreground">
        {initials}
      </div>
      <div className="space-y-(--spacing-tight) min-w-0">
        <p className="text-sm italic text-foreground/80 leading-relaxed">
          “{body}”
        </p>
        <p className="text-xs text-muted-foreground">
          <span className="text-foreground font-medium">{name}</span>
          {" · "}
          {meta}
        </p>
      </div>
    </figure>
  )
}
