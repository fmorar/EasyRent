"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import {
  MapPinIcon,
  AdjustmentsHorizontalIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline"
import { BedIcon } from "@/lib/property-icons"
import { PriceRangeFilter } from "@/components/marketplace/price-range-filter"
import { parseMarketplaceQuery } from "@/lib/actions/search.actions"
import { cn } from "@/lib/utils"

interface Props {
  /** Distinct location strings collected server-side for the dropdown. */
  locations: string[]
  /** When set, every filter change navigates to this path instead of
   *  rewriting the current URL. Use on the landing hero so picking a
   *  filter funnels the visitor into `/marketplace?…`. When omitted
   *  (the default on `/marketplace`) the bar updates the URL in place. */
  destinationPath?: string
}

/**
 * Marketplace filter bar — Idealista / Encuentra24-style layout.
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │  ¿Qué buscás?  │  Ubicación   │  Precio       │  Habitaciones    │
 *   │  [🏠 …      ]  │  [📍 …    ]  │  [$ …      ]  │  [🛏 …       ]   │
 *   ├──────────────────────────────────────────────────────────────────┤
 *   │  [Todo│Venta│Alquiler]  ⚙ Filtros  [Todos│Apto│Casa│…]   [Buscar]│
 *   └──────────────────────────────────────────────────────────────────┘
 */
export function MarketplaceFilterBar({ locations, destinationPath }: Props) {
  const router    = useRouter()
  const pathname  = usePathname()
  const params    = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const t = useTranslations("marketplace.filterBar")

  // Strip the locale prefix (e.g. `/es/marketplace`) before comparing
  // to `destinationPath` so the same path on different locales counts
  // as a match — we don't double-redirect.
  const stripLocale = (p: string) => p.replace(/^\/(?:es|en)(?=\/|$)/, "") || "/"
  const baseHref =
    destinationPath && stripLocale(pathname) !== destinationPath
      ? destinationPath
      : ""

  const OPERATION_TABS = [
    { value: "sale", label: t("operationVenta")    },
    { value: "rent", label: t("operationAlquiler") },
  ]

  const TYPE_CHIPS = [
    { value: "",           label: t("typeAll")        },
    { value: "apartment",  label: t("typeApartment")  },
    { value: "house",      label: t("typeHouse")      },
    { value: "land",       label: t("typeLand")       },
    { value: "commercial", label: t("typeCommercial") },
    { value: "office",     label: t("typeOffice")     },
    { value: "warehouse",  label: t("typeWarehouse")  },
  ]

  const BEDROOM_OPTIONS = [
    { value: "",  label: t("anyBedrooms")           },
    { value: "1", label: t("bedroomsPlus", { n: 1 }) },
    { value: "2", label: t("bedroomsPlus", { n: 2 }) },
    { value: "3", label: t("bedroomsPlus", { n: 3 }) },
    { value: "4", label: t("bedroomsPlus", { n: 4 }) },
    { value: "5", label: t("bedroomsPlus", { n: 5 }) },
  ]

  const [query,    setQuery]    = useState(params.get("q") ?? "")
  const [aiBusy,   setAiBusy]   = useState(false)

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value); else next.delete(key)
    next.delete("page")
    startTransition(() => router.push(`${baseHref}?${next.toString()}`))
  }

  /** Set multiple params atomically. */
  const setParams = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v); else next.delete(k)
    }
    next.delete("page")
    startTransition(() => router.push(`${baseHref}?${next.toString()}`))
  }

  /**
   * Smart search submission — sends the query to the AI parser and
   * applies whatever structured filters it extracts (type, operation,
   * location, bedrooms, price range, furnished). Anything unparsed
   * survives as the free-text `q=` param.
   */
  async function submitSearch(e?: React.FormEvent) {
    e?.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) {
      // Empty submit just clears `q` and re-runs the URL with current filters
      setParam("q", "")
      return
    }

    setAiBusy(true)
    try {
      const parsed = await parseMarketplaceQuery(trimmed)
      // Merge parsed filters into the existing URL — preserve any filter
      // the user already set explicitly via the chips/dropdowns. We only
      // overwrite when the AI extracted something for that field.
      const next = new URLSearchParams(params.toString())
      const apply = (key: string, value: string | undefined) => {
        if (value && value.length > 0) next.set(key, value); else next.delete(key)
      }
      apply("q",         parsed.q)
      if (parsed.type)      apply("type",      parsed.type)
      if (parsed.operation) apply("operation", parsed.operation)
      if (parsed.location)  apply("location",  parsed.location)
      if (parsed.bedrooms)  apply("bedrooms",  String(parsed.bedrooms))
      if (parsed.furnished) apply("furnished", parsed.furnished ? "1" : "")
      if (parsed.price_min || parsed.price_max) {
        apply(
          "price",
          `${parsed.price_min ?? ""}-${parsed.price_max ?? ""}`,
        )
      }
      next.delete("page")

      // Sync the visible input to whatever residual text remains.
      if (parsed.q !== undefined) setQuery(parsed.q ?? "")

      startTransition(() => router.push(`${baseHref}?${next.toString()}`))
    } finally {
      setAiBusy(false)
    }
  }

  const currentType      = params.get("type")      ?? ""
  const currentOperation = params.get("operation") ?? ""
  const currentFurnished = params.get("furnished") ?? ""
  const currentBedrooms  = params.get("bedrooms")  ?? ""
  const currentLocation  = params.get("location")  ?? ""
  const currentPrice     = params.get("price")     ?? ""

  const isRent = currentOperation === "rent"

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card shadow-sm p-4 sm:p-5 space-y-4",
        isPending && "opacity-70 pointer-events-none",
      )}
    >
      {/* ── Top row: 4 input cells with icon prefix ──────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label={t("lookingFor")}>
          <form onSubmit={submitSearch} className="relative">
            <SparklesIcon
              className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none transition-colors",
                aiBusy ? "text-luxe animate-pulse" : "text-luxe/70",
              )}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("lookingForPlaceholder")}
              disabled={aiBusy}
              className="pl-9 pr-3 h-11 w-full rounded-xl border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background disabled:opacity-60 transition-[background-color,box-shadow] duration-(--duration-state) ease-(--ease-out-quart)"
            />
          </form>
        </Field>

        <Field label={t("location")}>
          <SelectInput
            icon={<MapPinIcon className="h-4 w-4" />}
            value={currentLocation}
            onChange={(v) => setParam("location", v)}
            options={[
              { value: "", label: t("anyLocation") },
              ...locations.map((l) => ({ value: l, label: l })),
            ]}
          />
        </Field>

        <Field label={isRent ? t("rentalPrice") : t("price")}>
          <PriceRangeFilter
            value={currentPrice}
            onChange={(v) => setParam("price", v)}
            mode={isRent ? "rent" : "sale"}
          />
        </Field>

        <Field label={t("bedrooms")}>
          <SelectInput
            icon={<BedIcon className="h-4 w-4" />}
            value={currentBedrooms}
            onChange={(v) => setParam("bedrooms", v)}
            options={BEDROOM_OPTIONS}
          />
        </Field>
      </div>

      {/* ── Bottom row: tabs · filter chips · CTA ─────────────
          Mobile: stacks vertically — operation pills row, chip
          row (horizontal scroll), CTA full width.
          Desktop: idealista-style single row. */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:flex-wrap">

        {/* Operation pill tabs — click an active tab again to clear */}
        <div className="inline-flex items-center gap-1 rounded-full bg-muted/40 p-1 self-start">
          {OPERATION_TABS.map((tab) => {
            const active = currentOperation === tab.value
            const next   = active ? "" : tab.value
            return (
              <button
                key={tab.value}
                type="button"
                aria-pressed={active}
                onClick={() => setParams({
                  operation: next,
                  furnished: next === "rent" ? currentFurnished : "",
                  // Switching operation invalidates rent/sale-specific
                  // price ranges. Clear it so we don't show stale filters.
                  price: "",
                })}
                className={cn(
                  "px-4 h-8 rounded-full text-xs font-medium transition-colors",
                  active
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Filter icon + property type chips */}
        <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground">
          <AdjustmentsHorizontalIcon className="h-4 w-4" />
          <span className="text-xs font-medium">{t("filters")}</span>
        </div>

        {/* Type chips — horizontal scroll on mobile, wrap+grow on
            desktop. -mx negatives let the scroll area bleed to the
            card edges so chips don't crowd against the padding. */}
        <div className="flex items-center gap-1.5 overflow-x-auto sm:overflow-visible sm:flex-wrap sm:flex-1 sm:min-w-0 -mx-1 px-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {TYPE_CHIPS.map((chip) => {
            const active = currentType === chip.value
            return (
              <button
                key={chip.value || "all"}
                type="button"
                onClick={() => setParam("type", chip.value)}
                className={cn(
                  "h-8 px-3 rounded-full text-xs font-medium transition-colors border shrink-0",
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground",
                )}
              >
                {chip.label}
              </button>
            )
          })}

          {/* Furnished — only when rent active */}
          {isRent && (
            <button
              type="button"
              onClick={() =>
                setParam("furnished", currentFurnished === "1" ? "" : "1")
              }
              className={cn(
                "h-8 px-3 rounded-full text-xs font-medium transition-colors border inline-flex items-center gap-1.5 shrink-0",
                currentFurnished === "1"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground",
              )}
            >
              {currentFurnished === "1" ? "✓" : null}
              {t("amueblado")}
            </button>
          )}
        </div>

        {/* CTA — runs AI parsing on the query input. Full width on
            mobile (the row is vertical there) so the button reads as
            the primary action; auto-width on desktop. */}
        <button
          type="button"
          onClick={submitSearch}
          disabled={aiBusy}
          className="h-10 px-5 rounded-xl bg-foreground text-background text-sm font-heading font-semibold hover:bg-foreground/90 transition-colors shrink-0 w-full sm:w-auto sm:ml-auto justify-center disabled:opacity-60 inline-flex items-center gap-2"
        >
          {aiBusy ? (
            <>
              <SparklesIcon className="h-4 w-4 animate-pulse" />
              {t("analyzing")}
            </>
          ) : (
            <>{t("search")}</>
          )}
        </button>
      </div>
    </div>
  )
}

// ── Subcomponents ─────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground px-1">
        {label}
      </span>
      {children}
    </label>
  )
}

function SelectInput({
  icon,
  value,
  onChange,
  options,
}: {
  icon:     React.ReactNode
  value:    string
  onChange: (v: string) => void
  options:  { value: string; label: string }[]
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
        {icon}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 pr-3 h-11 w-full rounded-xl border bg-muted/30 text-sm font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background cursor-pointer transition-[background-color,box-shadow] duration-(--duration-state) ease-(--ease-out-quart)"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {/* Custom chevron */}
      <svg
        className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M3 5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
