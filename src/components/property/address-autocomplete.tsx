"use client"

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useTransition,
  type KeyboardEvent,
} from "react"
import { Input } from "@/components/ui/input"
import { MapPinIcon } from "@heroicons/react/24/outline"
import { searchAddresses } from "@/lib/actions/geocoding.actions"
import type { AddressSuggestion } from "@/lib/actions/geocoding.types"
import { cn } from "@/lib/utils"

interface Props {
  id?:          string
  value:        string
  onChange:     (value: string) => void
  onSelect?:    (suggestion: AddressSuggestion) => void  // fires when user picks from dropdown
  onBlur?:      () => void
  placeholder?: string
  disabled?:    boolean
}

export function AddressAutocomplete({ id, value, onChange, onSelect, onBlur, placeholder, disabled }: Props) {
  const [inputValue,  setInputValue]  = useState(value)
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [open,        setOpen]        = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isPending,   startTransition] = useTransition()

  const containerRef  = useRef<HTMLDivElement>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep internal value in sync when parent resets the field
  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [])

  const fetchSuggestions = useCallback((query: string) => {
    startTransition(async () => {
      const results = await searchAddresses(query)
      setSuggestions(results)
      setOpen(results.length > 0)
      setActiveIndex(-1)
    })
  }, [])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setInputValue(v)
    onChange(v)

    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    if (v.trim().length < 3) {
      setSuggestions([])
      setOpen(false)
      return
    }

    debounceTimer.current = setTimeout(() => fetchSuggestions(v), 320)
  }

  function handleSelect(suggestion: AddressSuggestion) {
    setInputValue(suggestion.displayName)
    onChange(suggestion.displayName)
    onSelect?.(suggestion)
    setSuggestions([])
    setOpen(false)
    setActiveIndex(-1)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault()
      handleSelect(suggestions[activeIndex])
    } else if (e.key === "Escape") {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPinIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          id={id}
          value={inputValue}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className="pl-8"
        />
        {isPending && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-md overflow-hidden">
          <ul role="listbox">
            {suggestions.map((s, i) => (
              <li
                key={s.id}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(s) }}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  "flex items-start gap-2.5 px-3 py-2.5 cursor-pointer text-sm",
                  i === activeIndex ? "bg-accent" : "hover:bg-accent/50",
                )}
              >
                <MapPinIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{s.shortName}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.secondaryName}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
