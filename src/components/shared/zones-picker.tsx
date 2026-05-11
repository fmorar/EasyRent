"use client"

import { useState, useMemo } from "react"
import {
  CATEGORIES,
  ZONE_BY_CODE,
  isZoneCode,
  isSubzoneCode,
  type ZoneCode,
  type SubzoneCode,
  type Zone,
} from "@/lib/zones"
import {
  CheckIcon,
  ChevronDownIcon,
  PlusIcon,
} from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils"

export interface CustomZone {
  /** Unique code (e.g. user-generated slug). */
  code:  string
  label: string
}

interface Props {
  /** Currently selected codes (mix of zone codes + subzone codes + custom codes). */
  value:    string[]
  onChange: (next: string[]) => void
  /** Optional list of user-created zones rendered as a separate section. */
  customZones?: CustomZone[]
  /** Optional callback to add a new custom zone (opens a prompt). */
  onCreateCustomZone?: (label: string) => Promise<void>
  disabled?: boolean
}

/**
 * 3-level hierarchical zone picker.
 *
 *   Category accordion
 *     └─ Zone row  ← click to toggle whole-zone coverage
 *         └─ Subzone chips  ← click to toggle a single district
 *
 * Supports mixing whole-zone + subzone selections per agent. The state
 * machine lives in `value: string[]`; consumer normalises it.
 */
export function ZonesPicker({
  value,
  onChange,
  customZones = [],
  onCreateCustomZone,
  disabled,
}: Props) {
  const selected = useMemo(() => new Set(value), [value])

  const [openCategories, setOpenCategories] = useState<Set<string>>(() => {
    // Auto-open any category that contains a selected code
    const open = new Set<string>()
    for (const cat of CATEGORIES) {
      const hasSel = cat.zones.some((z) =>
        selected.has(z.code) || z.subzones.some((s) => selected.has(s.code)),
      )
      if (hasSel) open.add(cat.code)
    }
    return open
  })

  function toggleCategoryOpen(code: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else                next.add(code)
      return next
    })
  }

  function toggleZone(zone: Zone) {
    const next = new Set(selected)
    if (next.has(zone.code)) {
      // Whole-zone is currently selected → remove it
      next.delete(zone.code)
    } else {
      // Switch to whole-zone: clear any individual subzone picks for this zone
      for (const sz of zone.subzones) next.delete(sz.code)
      next.add(zone.code)
    }
    onChange(Array.from(next))
  }

  function toggleSubzone(zoneCode: ZoneCode, subzoneCode: SubzoneCode) {
    const next = new Set(selected)
    // If the whole zone is selected, switch to picking specific subzones:
    // start from "none" + add the one being toggled.
    if (next.has(zoneCode)) {
      next.delete(zoneCode)
      next.add(subzoneCode)
    } else if (next.has(subzoneCode)) {
      next.delete(subzoneCode)
    } else {
      next.add(subzoneCode)
    }
    onChange(Array.from(next))
  }

  function toggleCustom(code: string) {
    const next = new Set(selected)
    if (next.has(code)) next.delete(code)
    else                next.add(code)
    onChange(Array.from(next))
  }

  async function handleCreateCustom() {
    if (!onCreateCustomZone) return
    const label = window.prompt("Nombre de la zona nueva:")
    if (!label || !label.trim()) return
    await onCreateCustomZone(label.trim())
  }

  return (
    <div className="space-y-3">
      {CATEGORIES.map((cat) => {
        const isOpen = openCategories.has(cat.code)
        const totalSelected = cat.zones.reduce((acc, z) => {
          if (selected.has(z.code)) return acc + z.subzones.length
          return acc + z.subzones.filter((s) => selected.has(s.code)).length
        }, 0)
        const totalSubzones = cat.zones.reduce((acc, z) => acc + z.subzones.length, 0)

        return (
          <div key={cat.code} className="rounded-lg border bg-card">
            {/* Category header — accordion trigger */}
            <button
              type="button"
              onClick={() => toggleCategoryOpen(cat.code)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors rounded-lg"
            >
              <div className="flex items-center gap-3 min-w-0">
                <ChevronDownIcon
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform shrink-0",
                    !isOpen && "-rotate-90",
                  )}
                />
                <span className="text-sm font-heading font-semibold">
                  {cat.label}
                </span>
              </div>
              <span className="text-xs font-numeric text-muted-foreground shrink-0">
                {totalSelected > 0
                  ? `${totalSelected}/${totalSubzones}`
                  : `${totalSubzones} áreas`}
              </span>
            </button>

            {/* Zones + subzones */}
            {isOpen && (
              <div className="border-t divide-y">
                {cat.zones.map((zone) => {
                  const wholeSelected = selected.has(zone.code)
                  const someSelected = zone.subzones.some((s) => selected.has(s.code))
                  return (
                    <div key={zone.code} className="px-4 py-3 space-y-2">
                      {/* Zone row — toggles whole zone */}
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => toggleZone(zone)}
                          className={cn(
                            "inline-flex items-center gap-2 text-sm font-medium transition-colors group",
                            wholeSelected
                              ? "text-foreground font-semibold"
                              : "text-foreground hover:text-foreground/80",
                          )}
                        >
                          <span
                            className={cn(
                              "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                              wholeSelected
                                ? "bg-primary border-primary"
                                : someSelected
                                  ? "border-primary bg-primary/20"
                                  : "border-input bg-background group-hover:border-primary/40",
                            )}
                          >
                            {wholeSelected && (
                              <CheckIcon className="h-3 w-3 text-primary-foreground" />
                            )}
                            {!wholeSelected && someSelected && (
                              <span className="h-1.5 w-1.5 rounded-sm bg-primary" />
                            )}
                          </span>
                          {zone.label}
                          {wholeSelected && (
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-normal">
                              · toda
                            </span>
                          )}
                        </button>
                        <span className="text-[11px] font-numeric text-muted-foreground">
                          {zone.subzones.length}
                        </span>
                      </div>

                      {/* Subzone chips */}
                      <div className="flex flex-wrap gap-1.5 pl-6">
                        {zone.subzones.map((sz) => {
                          const isSel = wholeSelected || selected.has(sz.code)
                          return (
                            <button
                              key={sz.code}
                              type="button"
                              disabled={disabled}
                              onClick={() => toggleSubzone(zone.code, sz.code)}
                              className={cn(
                                "inline-flex items-center gap-1 h-7 px-2.5 rounded-full border text-xs transition-colors disabled:opacity-50",
                                isSel
                                  ? "bg-primary/15 border-primary/40 text-foreground font-medium"
                                  : "bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                              )}
                            >
                              {isSel && <CheckIcon className="h-3 w-3" />}
                              {sz.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Custom zones section */}
      {(customZones.length > 0 || onCreateCustomZone) && (
        <div className="rounded-lg border bg-card px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-heading font-semibold">Zonas personalizadas</p>
            {onCreateCustomZone && (
              <button
                type="button"
                disabled={disabled}
                onClick={handleCreateCustom}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full border text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                <PlusIcon className="h-3 w-3" />
                Nueva
              </button>
            )}
          </div>

          {customZones.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Aún no hay zonas personalizadas. Crea una si tu cobertura no encaja en las anteriores.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {customZones.map((cz) => {
                const isSel = selected.has(cz.code)
                return (
                  <button
                    key={cz.code}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleCustom(cz.code)}
                    className={cn(
                      "inline-flex items-center gap-1 h-7 px-2.5 rounded-full border text-xs transition-colors disabled:opacity-50",
                      isSel
                        ? "bg-primary/15 border-primary/40 text-foreground font-medium"
                        : "bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {isSel && <CheckIcon className="h-3 w-3" />}
                    {cz.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Re-export so consumers don't have to deal with the shape directly
export { ZONE_BY_CODE, isZoneCode, isSubzoneCode }
