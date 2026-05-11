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
import { getTranslations } from "next-intl/server"
import type { Metadata } from "next"
import { OwnerLeadForm } from "@/components/contact/owner-lead-form"
import { PublicFooter } from "@/components/layout/public-footer"
import {
  ClockIcon,
  ChartBarSquareIcon,
  Squares2X2Icon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/solid"

export const revalidate = 600

export async function generateMetadata(): Promise<Metadata> {
  return {
    title:       "Contacto · vendé o alquilá tu propiedad",
    description:
      "Conectamos tu propiedad con compradores e inquilinos verificados en Costa Rica. Valoración sin compromiso, marketing profesional y documentación al día.",
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-(--spacing-major) lg:py-(--spacing-massive) space-y-(--spacing-major)">

        {/* ── Hero + form, 2-col on desktop. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-(--spacing-section) lg:gap-(--spacing-major) items-start">
          {/* Left — pitch + CTA */}
          <div className="space-y-(--spacing-block)">
            <h1
              className="font-heading font-bold tracking-tight leading-[1.02] text-foreground"
              style={{ fontSize: "clamp(2.5rem, 5.5vw, 4.5rem)" }}
            >
              {t("heroTitle")}{" "}
              <span className="text-foreground/40">{t("heroTitleAccent")}</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
              {t("heroLead")}
            </p>
            <div className="pt-(--spacing-tight)">
              <a
                href="#cuentanos"
                className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors duration-(--duration-state) ease-(--ease-out-quart)"
              >
                {t("heroCta")}
              </a>
            </div>
          </div>

          {/* Right — form */}
          <div id="cuentanos" className="lg:pt-(--spacing-tight)">
            <OwnerLeadForm />
          </div>
        </div>

        {/* ── Testimonial row — two short quotes from real owners. */}
        <div className="border-t pt-(--spacing-block)">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-(--spacing-block) lg:gap-(--spacing-section)">
            <Quote
              initials="MC"
              name={t("quote1Name")}
              meta={t("quote1Meta")}
              body={t("quote1Body")}
              accent="primary"
            />
            <Quote
              initials="JR"
              name={t("quote2Name")}
              meta={t("quote2Meta")}
              body={t("quote2Body")}
              accent="editorial"
            />
          </div>
        </div>

        {/* ── 4-up feature grid — icon + title + small body. */}
        <div className="border-t pt-(--spacing-section)">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-(--spacing-block) lg:gap-(--spacing-section)">
            <Feature
              icon={<ClockIcon className="h-5 w-5" />}
              title={t("feat1Title")}
              body={t("feat1Body")}
            />
            <Feature
              icon={<ChartBarSquareIcon className="h-5 w-5" />}
              title={t("feat2Title")}
              body={t("feat2Body")}
            />
            <Feature
              icon={<Squares2X2Icon className="h-5 w-5" />}
              title={t("feat3Title")}
              body={t("feat3Body")}
            />
            <Feature
              icon={<ChatBubbleLeftRightIcon className="h-5 w-5" />}
              title={t("feat4Title")}
              body={t("feat4Body")}
            />
          </div>
        </div>
      </div>

      <PublicFooter wordmarkPhotoUrl={cover?.url ?? null} />
    </div>
  )
}

// ── Pieces ──────────────────────────────────────────────────────

/**
 * Small testimonial card — avatar-style initials box on the left,
 * italic body on the right. The accent color rotates per instance.
 */
function Quote({
  initials, name, meta, body, accent,
}: {
  initials: string
  name:     string
  meta:     string
  body:     string
  accent:   "primary" | "editorial"
}) {
  return (
    <figure className="flex items-start gap-(--spacing-cluster)">
      <div
        className={
          "shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-xs font-numeric font-semibold " +
          (accent === "primary"
            ? "bg-primary text-foreground"
            : "bg-editorial-soft text-editorial")
        }
      >
        {initials}
      </div>
      <div className="space-y-1 min-w-0">
        <p className="text-sm italic text-foreground/80 leading-relaxed">
          “{body}”
        </p>
        <p className="text-[11px] text-muted-foreground">
          <span className="text-foreground font-medium">{name}</span>
          {" · "}
          {meta}
        </p>
      </div>
    </figure>
  )
}

/**
 * Bottom-row feature tile — icon stacked above title + body. Tight,
 * scannable; no card chrome (the outer card holds the whole block).
 */
function Feature({
  icon, title, body,
}: {
  icon: React.ReactNode
  title: string
  body:  string
}) {
  return (
    <div className="space-y-(--spacing-cluster)">
      <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-primary text-foreground">
        {icon}
      </span>
      <div className="space-y-1">
        <p className="text-sm font-heading font-semibold leading-snug">{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
      </div>
    </div>
  )
}
