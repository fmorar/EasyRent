"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { CurrencyDollarIcon } from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils"

interface Props {
  /** URL value: "min-max" / "min-" / "-max" / "" */
  value:    string
  onChange: (value: string) => void
  /** Tier of bounds + step. Driven by the active operation tab. */
  mode:     "sale" | "rent"
}

const TIERS = {
  sale: { min: 0, max: 2_000_000, step: 5_000  },
  rent: { min: 0, max: 10_000,    step: 50     },
}

/**
 * Compact USD formatter used for the slider labels.
 *   $250,000 → "$250k"   ·   $1,500,000 → "$1.5M"   ·   $1,200 → "$1,200"
 */
function compactUsd(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`
  }
  if (n >= 10_000) {
    return `$${Math.round(n / 1000)}k`
  }
  return `$${n.toLocaleString("en-US")}`
}

function parseValue(value: string, mode: "sale" | "rent"): [number, number] {
  const tier = TIERS[mode]
  if (!value) return [tier.min, tier.max]
  const [minStr, maxStr] = value.split("-")
  const min = minStr ? Number(minStr) : tier.min
  const max = maxStr ? Number(maxStr) : tier.max
  return [
    Number.isFinite(min) ? Math.max(tier.min, min) : tier.min,
    Number.isFinite(max) ? Math.min(tier.max, max) : tier.max,
  ]
}

function serializeValue(range: [number, number], mode: "sale" | "rent"): string {
  const tier = TIERS[mode]
  const [lo, hi] = range
  // Drop the param when both ends are at the bounds (no filter)
  if (lo <= tier.min && hi >= tier.max) return ""
  const minPart = lo > tier.min ? String(lo) : ""
  const maxPart = hi < tier.max ? String(hi) : ""
  return `${minPart}-${maxPart}`
}

/**
 * Compact label shown on the trigger button.
 * Uses i18n format strings so the label localises cleanly.
 */
function formatTriggerLabel(
  value:  string,
  mode:   "sale" | "rent",
  t:      (key: string, vars?: Record<string, string>) => string,
): string {
  if (!value) return mode === "rent" ? t("anyRentLabel") : t("anyPriceLabel")
  const [minStr, maxStr] = value.split("-")
  const min = minStr ? Number(minStr) : null
  const max = maxStr ? Number(maxStr) : null
  if (min != null && max != null) return t("rangeLabel", { from: compactUsd(min), to: compactUsd(max) })
  if (min != null)                return t("fromLabel",  { value: compactUsd(min) })
  if (max != null)                return t("untilLabel", { value: compactUsd(max) })
  return t("anyPriceLabel")
}

export function PriceRangeFilter({ value, onChange, mode }: Props) {
  const tier = TIERS[mode]
  const t    = useTranslations("marketplace.priceRange")
  const [open,  setOpen]  = useState(false)
  const [range, setRange] = useState<[number, number]>(() => parseValue(value, mode))

  // Re-sync local state when the URL or mode changes from outside.
  useEffect(() => {
    setRange(parseValue(value, mode))
  }, [value, mode])

  function commit(next: [number, number]) {
    onChange(serializeValue(next, mode))
  }

  function reset() {
    const cleared: [number, number] = [tier.min, tier.max]
    setRange(cleared)
    onChange("")
  }

  const isActive = !!value

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "relative pl-9 pr-9 h-11 w-full rounded-xl border bg-muted/30 text-sm font-medium text-left flex items-center cursor-pointer transition-colors",
              "hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive && "border-foreground/40",
            )}
          >
            <CurrencyDollarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <span className={cn("truncate", !isActive && "text-muted-foreground font-normal")}>
              {formatTriggerLabel(value, mode, (k, v) => t(k as Parameters<typeof t>[0], v))}
            </span>
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M3 5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        }
      />

      <PopoverContent className="w-[320px] p-4 space-y-4" sideOffset={8}>
        <div className="space-y-1">
          <p className="text-sm font-heading font-semibold">
            {mode === "rent" ? t("rentHeading") : t("saleHeading")}
          </p>
          <p className="text-xs text-muted-foreground">{t("instructions")}</p>
        </div>

        {/* Live range display */}
        <div className="flex items-center justify-between text-sm font-numeric">
          <span className="font-medium">{compactUsd(range[0])}</span>
          <span className="text-muted-foreground">—</span>
          <span className="font-medium">{compactUsd(range[1])}</span>
        </div>

        {/* The slider itself */}
        <Slider
          min={tier.min}
          max={tier.max}
          step={tier.step}
          value={range}
          onValueChange={(v) => setRange(v as [number, number])}
          onValueCommitted={(v) => commit(v as [number, number])}
        />

        {/* Min / max pill labels */}
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground/70">
          <span>{compactUsd(tier.min)}</span>
          <span>{compactUsd(tier.max)}{range[1] >= tier.max ? "+" : ""}</span>
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between pt-2 border-t">
          <button
            type="button"
            onClick={reset}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("clear")}
          </button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              commit(range)
              setOpen(false)
            }}
            className="bg-foreground text-background hover:bg-foreground/90"
          >
            {t("apply")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
