"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronUpDownIcon, CheckIcon } from "@heroicons/react/24/outline"
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"

export interface Country {
  code: string
  name: string
  dial: string
  flag: string
}

interface Props {
  /** Currently selected dial code (e.g. "+506"). Component is controlled. */
  value:    string
  onChange: (dial: string, country: Country) => void
  /** Disable the trigger (e.g. while the form is submitting). */
  disabled?: boolean
  /** Optional className for the trigger button. */
  className?: string
  /** Default selection when the API answers but `value` isn't in the
   *  list — useful for "first paint" before the user has chosen. */
  defaultCode?: string
}

/**
 * Searchable country-code combobox. Pulls the list from
 * `/api/countries` once on mount (the route caches restcountries.com
 * for 24h server-side, so this is effectively free).
 *
 * Visual: a small pill showing the flag + dial code as the trigger;
 * the popover opens a search-as-you-type list with flag, name and
 * code per row. Defaults to Costa Rica.
 *
 * Why not a regular `<Select>`: 250 countries is too many to scroll
 * through. Search + filter is the only acceptable UX here.
 */
export function CountryCodeSelect({
  value, onChange, disabled, className, defaultCode = "CR",
}: Props) {
  const [open,      setOpen]      = useState(false)
  const [countries, setCountries] = useState<Country[]>(STATIC_DEFAULTS)
  const [loaded,    setLoaded]    = useState(false)

  // One-time fetch. We pre-seed with a small set of common countries
  // (CR + neighbours) so the dropdown is usable before /api/countries
  // resolves — important on slow networks.
  useEffect(() => {
    let mounted = true
    fetch("/api/countries", { cache: "force-cache" })
      .then((r) => r.json() as Promise<{ countries: Country[] }>)
      .then((j) => {
        if (!mounted) return
        if (Array.isArray(j.countries) && j.countries.length > 0) {
          setCountries(j.countries)
        }
        setLoaded(true)
      })
      .catch(() => { if (mounted) setLoaded(true) })
    return () => { mounted = false }
  }, [])

  const selected = useMemo(() => {
    // Match by current dial value first; fall back to defaultCode.
    return countries.find((c) => c.dial === value)
      ?? countries.find((c) => c.code === defaultCode)
      ?? countries[0]
  }, [countries, value, defaultCode])

  return (
    <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <PopoverTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            aria-label="Código de país"
            className={cn(
              // `h-8` matches the default `Input` and `Select` heights
              // in this design system — keeping them identical lets
              // the dropdown sit flush with whatever phone input it's
              // paired with. Callers can still override via `className`
              // when they need a taller variant (e.g. the agent
              // contact form uses pill-shaped `h-11` inputs).
              "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border bg-background text-sm font-medium",
              "hover:bg-muted transition-colors duration-(--duration-state) ease-(--ease-out-quart)",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              className,
            )}
          >
            <span className="text-base leading-none" aria-hidden>
              {selected?.flag || "🏳️"}
            </span>
            <span className="font-numeric tabular-nums">
              {selected?.dial || "+506"}
            </span>
            <ChevronUpDownIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </button>
        }
      />
      <PopoverContent align="start" className="p-0 w-72">
        <Command
          filter={(value, search) => {
            // Custom filter — cmdk lowercases both sides; we expand it to
            // also match the dial code so "506" finds Costa Rica.
            const v = value.toLowerCase()
            const s = search.toLowerCase().replace(/^\+/, "")
            return v.includes(s) ? 1 : 0
          }}
        >
          <CommandInput placeholder="Buscar país o código…" />
          <CommandList className="max-h-72">
            {!loaded && countries.length === 0 ? (
              <CommandEmpty>Cargando países…</CommandEmpty>
            ) : (
              <>
                <CommandEmpty>Sin resultados.</CommandEmpty>
                <CommandGroup>
                  {countries.map((c) => {
                    const isSelected = c.dial === value && c.code === selected?.code
                    return (
                      <CommandItem
                        key={c.code}
                        // `value` is what cmdk filters on. Bundle name +
                        // dial + code so all three are searchable.
                        value={`${c.name} ${c.dial} ${c.code}`}
                        onSelect={() => {
                          onChange(c.dial, c)
                          setOpen(false)
                        }}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span className="text-base leading-none w-6 shrink-0" aria-hidden>
                          {c.flag}
                        </span>
                        <span className="flex-1 min-w-0 truncate">{c.name}</span>
                        <span className="font-numeric tabular-nums text-muted-foreground text-xs">
                          {c.dial}
                        </span>
                        {isSelected && (
                          <CheckIcon className="h-3.5 w-3.5 text-foreground shrink-0" />
                        )}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// Pre-seed list — same shape as the route's FALLBACK, kept here too
// so the dropdown is usable before /api/countries resolves on the
// very first paint. Smaller than the API's full list to keep the
// bundle tight; the API replaces it on mount.
const STATIC_DEFAULTS: Country[] = [
  { code: "CR", name: "Costa Rica",      dial: "+506", flag: "🇨🇷" },
  { code: "US", name: "Estados Unidos",  dial: "+1",   flag: "🇺🇸" },
  { code: "MX", name: "México",          dial: "+52",  flag: "🇲🇽" },
  { code: "CO", name: "Colombia",        dial: "+57",  flag: "🇨🇴" },
  { code: "ES", name: "España",          dial: "+34",  flag: "🇪🇸" },
  { code: "AR", name: "Argentina",       dial: "+54",  flag: "🇦🇷" },
  { code: "PA", name: "Panamá",          dial: "+507", flag: "🇵🇦" },
  { code: "GT", name: "Guatemala",       dial: "+502", flag: "🇬🇹" },
  { code: "NI", name: "Nicaragua",       dial: "+505", flag: "🇳🇮" },
  { code: "SV", name: "El Salvador",     dial: "+503", flag: "🇸🇻" },
  { code: "HN", name: "Honduras",        dial: "+504", flag: "🇭🇳" },
  { code: "EC", name: "Ecuador",         dial: "+593", flag: "🇪🇨" },
]
