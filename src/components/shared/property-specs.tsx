import { BedIcon, BathIcon, RulerIcon } from "@/lib/property-icons"

interface Props {
  bedrooms?:  number | null
  bathrooms?: number | null
  area_sqm?:  number | null
  /** Visual size — "sm" for cards, "md" for detail pages. */
  size?:      "sm" | "md"
  /** When true, separates stats with a centered dot instead of plain gap. */
  withDots?:  boolean
  className?: string
}

/**
 * Standardized inline beds/baths/m² display for property cards and lists.
 * Hides items with null values automatically.
 */
export function PropertySpecs({
  bedrooms, bathrooms, area_sqm,
  size = "sm",
  withDots = true,
  className,
}: Props) {
  const items: { icon: React.ReactNode; value: number | string }[] = []
  if (bedrooms  != null) items.push({ icon: <BedIcon   className={iconCls(size)} />, value: bedrooms })
  if (bathrooms != null) items.push({ icon: <BathIcon  className={iconCls(size)} />, value: bathrooms })
  if (area_sqm  != null) items.push({ icon: <RulerIcon className={iconCls(size)} />, value: `${area_sqm} m²` })

  if (items.length === 0) return null

  return (
    <div className={`flex items-center gap-2 ${textCls(size)} text-muted-foreground ${className ?? ""}`}>
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && withDots && <span className="text-muted-foreground/40 mr-1">·</span>}
          {it.icon}
          <span className="font-numeric">{it.value}</span>
        </span>
      ))}
    </div>
  )
}

function iconCls(size: "sm" | "md") {
  return size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"
}
function textCls(size: "sm" | "md") {
  return size === "sm" ? "text-xs" : "text-sm"
}
