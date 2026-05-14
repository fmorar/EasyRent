import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Currency symbol lookup. We hand-roll this map (instead of letting
// `Intl.NumberFormat`'s `style: "currency"` do it) because Node.js
// can ship with a stripped-down ICU dataset that lacks symbols for
// less-common currencies — and falls back to the localized currency
// NAME ("600,000 Colones") instead of the symbol ("₡600,000").
//
// That divergence between server (Node) and client (browser, full
// ICU) was producing React hydration mismatches anywhere a CRC
// price was server-rendered. The number itself is formatted with
// `en-US` (no currency style) which is rock-solid across every JS
// runtime, so the output is now byte-identical on both sides.
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  CRC: "₡",
  EUR: "€",
  GBP: "£",
  MXN: "$",
  COP: "$",
}

// Currency formatter
export function formatPrice(amount: number, currency = "USD"): string {
  const code   = currency.toUpperCase()
  const symbol = CURRENCY_SYMBOLS[code]
  const number = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(amount)
  // Known symbol → tight form ("$1,300"); unknown code → space-separated
  // ("XYZ 1,300") so it stays readable.
  return symbol ? `${symbol}${number}` : `${code} ${number}`
}

/**
 * Same as `formatPrice` but appends "/mes" when the listing is a rental
 * — the convention every CR real-estate site uses to disambiguate
 * monthly rent from sale price.
 */
export function formatListingPrice(
  amount:      number,
  currency:    string | null | undefined,
  listingType: "sale" | "rent" | null | undefined,
): string {
  const base = formatPrice(amount, currency ?? "USD")
  return listingType === "rent" ? `${base} / mes` : base
}

// Slugify a string for use in URLs
/**
 * Build a wa.me link with an optional prefilled message. We strip
 * everything but digits from the phone (wa.me accepts the +country
 * code with no `+` or spaces) and URL-encode the message so emoji /
 * newlines / accented characters survive the trip through WhatsApp's
 * deeplink handler.
 *
 * Returns null when the phone is empty / unparseable so callers can
 * skip rendering the link instead of generating a broken /wa.me/
 * URL.
 */
export function buildWhatsAppLink(
  phone:    string | null | undefined,
  message?: string,
): string | null {
  const digits = (phone ?? "").replace(/\D/g, "")
  if (!digits) return null
  const base = `https://wa.me/${digits}`
  if (!message) return base
  return `${base}?text=${encodeURIComponent(message)}`
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
}

// Human-readable relative date
export function timeAgo(date: string | Date): string {
  const seconds = Math.floor(
    (new Date().getTime() - new Date(date).getTime()) / 1000
  )
  const intervals: [number, string][] = [
    [31536000, "year"],
    [2592000,  "month"],
    [86400,    "day"],
    [3600,     "hour"],
    [60,       "minute"],
  ]
  for (const [interval, label] of intervals) {
    const count = Math.floor(seconds / interval)
    if (count >= 1) return `${count} ${label}${count > 1 ? "s" : ""} ago`
  }
  return "just now"
}

// Property type display labels — re-exported from labels.ts for back-compat.
// New code should import from "@/lib/labels".
export { PROPERTY_TYPE_LABELS, LEAD_STAGE_LABELS } from "@/lib/labels"

// Pipeline stages in order
export const PIPELINE_STAGES = [
  "new",
  "contacted",
  "interested",
  "visit_scheduled",
  "negotiating",
  "contract_requested",
  "closed",
  "lost",
] as const
