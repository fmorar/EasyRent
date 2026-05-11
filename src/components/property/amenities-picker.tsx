"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { XMarkIcon, PlusIcon } from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils"
import { getAmenityIcon } from "@/lib/amenity-icons"

/**
 * Predefined common amenities for residential / commercial buildings in
 * Latin America. Users can also add custom entries.
 */
const COMMON_AMENITIES = [
  "Piscina",
  "Gimnasio",
  "Seguridad 24/7",
  "Acceso controlado",
  "Parqueo de visitas",
  "Área de BBQ",
  "Salón comunal",
  "Áreas verdes",
  "Juegos infantiles",
  "Cancha deportiva",
  "Spa",
  "Sauna",
  "Lavandería",
  "Ascensor",
  "Casa club",
  "Co-working",
  "Pet-friendly",
  "Vista panorámica",
  "Cerca de la playa",
  "Aire acondicionado",
] as const

interface Props {
  value:    string[]
  onChange: (amenities: string[]) => void
  disabled?: boolean
}

export function AmenitiesPicker({ value, onChange, disabled }: Props) {
  const [customInput, setCustomInput] = useState("")
  const [showCustom,  setShowCustom]  = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Selected set for O(1) lookups (case-insensitive)
  const selectedLower = new Set(value.map((v) => v.toLowerCase()))

  function toggle(amenity: string) {
    if (selectedLower.has(amenity.toLowerCase())) {
      onChange(value.filter((v) => v.toLowerCase() !== amenity.toLowerCase()))
    } else {
      onChange([...value, amenity])
    }
  }

  function addCustom() {
    const trimmed = customInput.trim()
    if (!trimmed) return
    if (!selectedLower.has(trimmed.toLowerCase())) {
      onChange([...value, trimmed])
    }
    setCustomInput("")
    setShowCustom(false)
  }

  // Custom amenities = ones not in the COMMON list
  const commonLower = new Set(COMMON_AMENITIES.map((a) => a.toLowerCase()))
  const customSelected = value.filter((v) => !commonLower.has(v.toLowerCase()))

  return (
    <div className="space-y-3">
      {/* Predefined chips */}
      <div className="flex flex-wrap gap-1.5">
        {COMMON_AMENITIES.map((amenity) => {
          const isSelected = selectedLower.has(amenity.toLowerCase())
          return (
            <button
              key={amenity}
              type="button"
              disabled={disabled}
              onClick={() => toggle(amenity)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              {getAmenityIcon(amenity, "h-3.5 w-3.5")}
              {amenity}
            </button>
          )
        })}

        {/* Custom amenities (already added) */}
        {customSelected.map((amenity) => (
          <span
            key={amenity}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
          >
            {getAmenityIcon(amenity, "h-3.5 w-3.5")}
            {amenity}
            <button
              type="button"
              disabled={disabled}
              onClick={() => toggle(amenity)}
              className="hover:bg-primary-foreground/20 rounded-full p-0.5 -mr-1 ml-0.5"
              aria-label={`Quitar ${amenity}`}
            >
              <XMarkIcon className="h-3 w-3" />
            </button>
          </span>
        ))}

        {/* + Custom button */}
        {!showCustom ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setShowCustom(true)
              setTimeout(() => inputRef.current?.focus(), 0)
            }}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <PlusIcon className="h-3 w-3" />
            Otra
          </button>
        ) : (
          <div className="inline-flex items-center gap-1">
            <Input
              ref={inputRef}
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addCustom() }
                if (e.key === "Escape") { setCustomInput(""); setShowCustom(false) }
              }}
              onBlur={() => { if (!customInput.trim()) setShowCustom(false) }}
              placeholder="Ej. Solárium"
              className="h-7 text-xs px-2 w-32"
              disabled={disabled}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 px-2 text-xs"
              onClick={addCustom}
              disabled={disabled || !customInput.trim()}
            >
              Agregar
            </Button>
          </div>
        )}
      </div>

      {value.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Selecciona las amenidades que ofrece la propiedad o el edificio.
        </p>
      )}
    </div>
  )
}
