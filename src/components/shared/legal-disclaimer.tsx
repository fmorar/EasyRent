"use client"

import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

/**
 * Canonical legal/privacy disclaimers used across the marketplace,
 * property pages, and forms. Centralised here so the strings stay
 * consistent and a future legal review only has to touch ONE file.
 *
 * Strings live in `messages/{locale}.json` under the `disclaimers`
 * namespace. See `.claude/skills/ux-writing-realestate`.
 *
 * Implemented as a client component so it works in both server- and
 * client-rendered trees without an `await` boundary.
 */
export type DisclaimerVariant =
  | "price"
  | "closing-costs"
  | "approximate-location"
  | "documentation"
  | "short-term-rental"
  | "investment"
  | "privacy"
  | "rental-terms"

const KEY: Record<DisclaimerVariant, string> = {
  "price":                 "price",
  "closing-costs":         "closingCosts",
  "approximate-location":  "approximateLocation",
  "documentation":         "documentation",
  "short-term-rental":     "shortTermRental",
  "investment":            "investment",
  "privacy":               "privacy",
  "rental-terms":          "rentalTerms",
}

interface Props {
  variant:    DisclaimerVariant
  /** Visual style. `inline` = single line subtle. `note` = blocky muted. */
  tone?:      "inline" | "note"
  className?: string
}

export function LegalDisclaimer({ variant, tone = "inline", className }: Props) {
  const t = useTranslations("disclaimers")
  const text = t(KEY[variant] as Parameters<typeof t>[0])

  if (tone === "note") {
    return (
      <p
        className={cn(
          "text-xs text-muted-foreground rounded-lg border bg-muted/30 px-3 py-2 leading-relaxed",
          className,
        )}
      >
        {text}
      </p>
    )
  }
  return (
    <p className={cn("text-[11px] text-muted-foreground/80 leading-relaxed", className)}>
      {text}
    </p>
  )
}
