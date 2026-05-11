"use client"

import { useTranslations } from "next-intl"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline"
import { formatPrice } from "@/lib/utils"

export interface PublicComparable {
  title:            string | null
  source_name:      string | null
  listing_url:      string | null
  location_text:    string | null
  canton:           string | null
  district:         string | null
  price:            number | null
  currency:         string | null
  bedrooms:         number | null
  bathrooms:        number | null
  built_area_m2:    number | null
  price_per_m2:     number | null
  similarity_score: number | null
}

interface Props {
  comparables: PublicComparable[]
  /** Default report currency, used when a row has no currency set. */
  fallbackCurrency: string
}

/**
 * Owner-facing list of the top comparables used to compute the
 * recommended price. Each row links out to the original public
 * listing so the owner can verify the source.
 *
 * Privacy: we only render data the comparable was published with.
 * We never expose raw scraped text or the agent/company that
 * authored the listing.
 */
export function PublicComparablesList({ comparables, fallbackCurrency }: Props) {
  const t = useTranslations("marketReportPublic.comparables")

  if (comparables.length === 0) {
    return null
  }

  return (
    <section className="space-y-3">
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="text-base font-heading font-semibold">{t("title")}</h2>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </header>

      <Card className="divide-y">
        {comparables.map((c, i) => (
          <ComparableRow
            key={`${c.listing_url ?? "row"}-${i}`}
            c={c}
            fallbackCurrency={fallbackCurrency}
            t={t}
          />
        ))}
      </Card>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {t("footnote")}
      </p>
    </section>
  )
}

function ComparableRow({
  c, fallbackCurrency, t,
}: {
  c: PublicComparable
  fallbackCurrency: string
  t: (k: string, v?: Record<string, string | number>) => string
}) {
  const currency = c.currency ?? fallbackCurrency
  const location = c.location_text ?? [c.district, c.canton].filter(Boolean).join(", ") ?? "—"

  const specs = [
    c.bedrooms != null     ? t("bedShort",  { n: c.bedrooms })  : null,
    c.bathrooms != null    ? t("bathShort", { n: c.bathrooms }) : null,
    c.built_area_m2 != null ? `${c.built_area_m2} m²`           : null,
  ].filter(Boolean).join(" · ")

  return (
    <div className="flex items-start gap-3 px-4 py-3 sm:px-5 sm:py-4">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium truncate">{c.title ?? "—"}</p>
          <p className="text-sm font-numeric font-semibold shrink-0">
            {c.price != null ? formatPrice(c.price, currency) : "—"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span className="truncate">{location}</span>
          {specs && <><span>·</span><span className="font-numeric">{specs}</span></>}
          {c.price_per_m2 != null && (
            <><span>·</span><span className="font-numeric">{Math.round(c.price_per_m2)} {currency}/m²</span></>
          )}
        </div>
        <div className="flex items-center gap-2 pt-0.5">
          {c.similarity_score != null && (
            <Badge variant="outline" className="text-[10px] font-numeric">
              {t("similarity", { n: Math.round(c.similarity_score) })}
            </Badge>
          )}
          {c.source_name && (
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
              {c.source_name}
            </span>
          )}
        </div>
      </div>

      {c.listing_url && (
        <a
          href={c.listing_url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="shrink-0 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          aria-label={t("openLinkAria")}
        >
          <span className="hidden sm:inline">{t("openLink")}</span>
          <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  )
}
