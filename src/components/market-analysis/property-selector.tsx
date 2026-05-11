"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChevronUpDownIcon,
  CheckIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline"
import { formatListingPrice, cn } from "@/lib/utils"

export interface PropertyOption {
  id:               string
  title:            string
  slug:             string
  property_type:    string
  listing_type:     "sale" | "rent"
  bedrooms:         number | null
  bathrooms:        number | null
  parking_spaces:   number | null
  area_sqm:         number | null
  maintenance_fee:  number | null
  price:            number | null
  currency:         string | null
  display_address:  string | null
  /** Cover photo URL — picked server-side from property_photos. */
  cover_url?:       string | null
}

interface Props {
  properties: PropertyOption[]
  value:      string | null
  onChange:   (id: string, prop: PropertyOption) => void
}

/**
 * Combobox-style property selector.
 *
 * - Trigger doubles as an at-a-glance summary (thumbnail + title +
 *   address) when an option is selected, or as a search affordance
 *   ("Buscar y seleccionar propiedad") when empty.
 * - Popover opens a `<Command>` palette: live full-text filter on
 *   title + address. Each item shows a 48×48 thumbnail (cover photo
 *   or placeholder), title, address, and a small specs row.
 * - Keyboard-friendly out of the box (cmdk handles arrow keys,
 *   Enter, Esc).
 */
export function PropertySelector({ properties, value, onChange }: Props) {
  const t   = useTranslations("marketAnalysisForm")
  const tOp = useTranslations("marketAnalysis.operation")

  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState("")

  const selected = properties.find((p) => p.id === value) ?? null

  // Filter on title + display_address. cmdk's built-in `value`-based
  // filtering doesn't see our subtitle field, so we filter manually
  // and pass `shouldFilter={false}`.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return properties
    return properties.filter((p) => {
      const haystack = `${p.title} ${p.display_address ?? ""}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [properties, query])

  // Empty state — no properties at all
  if (properties.length === 0) {
    return (
      <div className="rounded-md border bg-muted/30 px-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">{t("noProperties")}</p>
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-between gap-3 px-3 h-auto py-2 text-left",
              "data-[state=open]:ring-2 data-[state=open]:ring-ring/40",
            )}
            aria-expanded={open}
          >
            {selected ? (
              <SelectedRow option={selected} operationLabel={tOp(selected.listing_type)} />
            ) : (
              <span className="flex items-center gap-3 text-muted-foreground py-1.5">
                <span className="h-9 w-9 rounded-md border bg-muted flex items-center justify-center shrink-0">
                  <PhotoIcon className="h-4 w-4 opacity-60" />
                </span>
                <span className="text-sm">{t("selectProperty")}</span>
              </span>
            )}
            <ChevronUpDownIcon className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        }
      />

      <PopoverContent
        align="start"
        className="p-0 w-[var(--anchor-width)] min-w-[280px]"
        style={{ "--anchor-width": "var(--radix-popover-trigger-width, 100%)" } as React.CSSProperties}
        sideOffset={6}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("searchPlaceholder")}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[320px]">
            {filtered.length === 0 ? (
              <CommandEmpty>{t("searchEmpty", { query })}</CommandEmpty>
            ) : (
              <CommandGroup>
                {filtered.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.id}
                    onSelect={() => {
                      onChange(p.id, p)
                      setOpen(false)
                      setQuery("")
                    }}
                    className="gap-3 py-2.5 items-start"
                    data-checked={p.id === value || undefined}
                  >
                    <Thumbnail src={p.cover_url} alt={p.title} />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug line-clamp-2 min-w-0">
                          {p.title}
                        </p>
                        {p.id === value && (
                          <CheckIcon className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
                        )}
                      </div>
                      {p.display_address && (
                        <p className="text-xs text-muted-foreground truncate">
                          {p.display_address}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <Badge variant="secondary" className="text-[10px]">
                          {tOp(p.listing_type)}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {p.property_type}
                        </Badge>
                        {p.area_sqm != null && (
                          <span className="text-[11px] text-muted-foreground font-numeric">
                            {p.area_sqm} m²
                          </span>
                        )}
                        {p.bedrooms != null && (
                          <span className="text-[11px] text-muted-foreground font-numeric">
                            · {p.bedrooms} hab
                          </span>
                        )}
                        {p.price != null && (
                          <span className="text-[11px] font-numeric font-medium ml-auto shrink-0">
                            {formatListingPrice(p.price, p.currency, p.listing_type)}
                          </span>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ── Subcomponents ──────────────────────────────────────────────────

function SelectedRow({
  option, operationLabel,
}: { option: PropertyOption; operationLabel: string }) {
  const specs = [
    option.bedrooms      != null ? `${option.bedrooms} hab`    : null,
    option.bathrooms     != null ? `${option.bathrooms} bn`    : null,
    option.area_sqm      != null ? `${option.area_sqm} m²`     : null,
  ].filter(Boolean).join(" · ")

  return (
    <span className="flex items-center gap-3 min-w-0 flex-1">
      <Thumbnail src={option.cover_url} alt={option.title} />
      <span className="flex-1 min-w-0 space-y-0.5 text-left">
        <span className="block text-sm font-medium truncate">{option.title}</span>
        {option.display_address && (
          <span className="block text-xs text-muted-foreground truncate">
            {option.display_address}
          </span>
        )}
        {(specs || option.listing_type) && (
          <span className="block text-[11px] text-muted-foreground font-numeric truncate">
            {operationLabel}{specs ? ` · ${specs}` : ""}
          </span>
        )}
      </span>
    </span>
  )
}

function Thumbnail({ src, alt }: { src?: string | null; alt: string }) {
  return (
    <span className="h-12 w-12 rounded-md border bg-muted overflow-hidden shrink-0 flex items-center justify-center">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <PhotoIcon className="h-5 w-5 opacity-40" />
      )}
    </span>
  )
}
