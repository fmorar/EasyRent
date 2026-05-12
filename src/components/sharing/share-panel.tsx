"use client"

import { useState, useTransition, useMemo, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  TrashIcon as Trash2,
  ClockIcon as Clock,
  CheckCircleIcon as CheckCircle2,
  XCircleIcon as XCircle,
  UsersIcon,
  XMarkIcon,
  MapPinIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline"
import { shareProperty, revokeShare } from "@/lib/actions/share.actions"
import {
  CATEGORIES,
  expandToSubzones,
  formatZoneList,
  type CategoryCode,
  type ZoneCode,
} from "@/lib/zones"
import { listCustomZones, type CustomZoneRow } from "@/lib/actions/zones.actions"
import { cn } from "@/lib/utils"
import type { PropertyShare, Profile } from "@/types"

interface SharePanelProps {
  propertyId: string
  shares:     (PropertyShare & { shared_with_profile: Profile })[]
  agents:     Profile[]
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending:  <Clock className="h-3.5 w-3.5 text-warning" />,
  approved: <CheckCircle2 className="h-3.5 w-3.5 text-success" />,
  rejected: <XCircle className="h-3.5 w-3.5 text-destructive" />,
  revoked:  <XCircle className="h-3.5 w-3.5 text-muted-foreground" />,
}

const COMMISSION_TYPE_LABELS: Record<"percentage" | "fixed", string> = {
  percentage: "Porcentaje",
  fixed:      "Monto fijo",
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function SharePanel({ propertyId, shares: initialShares, agents }: SharePanelProps) {
  const router = useRouter()

  const [shares,           setShares]           = useState(initialShares)
  const [selectedIds,      setSelectedIds]      = useState<Set<string>>(new Set())
  const [query,            setQuery]            = useState("")
  const [searchOpen,       setSearchOpen]       = useState(false)
  const [commissionSplit,  setCommissionSplit]   = useState<string>("50")
  const [commissionType,   setCommissionType]    = useState<"percentage" | "fixed">("percentage")
  const [submitting,       setSubmitting]        = useState(false)
  const [error,            setError]             = useState<string | null>(null)
  const [revokingId,       setRevokingId]        = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const inputRef = useRef<HTMLInputElement>(null)

  // Agents already shared with (active shares)
  const sharedWithIds = useMemo(
    () => new Set(
      shares
        .filter((s) => s.deleted_at === null && s.status !== "revoked")
        .map((s) => s.shared_with),
    ),
    [shares],
  )

  const availableAgents = useMemo(
    () => agents.filter((a) => !sharedWithIds.has(a.id)),
    [agents, sharedWithIds],
  )

  const selectedAgents = useMemo(
    () => availableAgents.filter((a) => selectedIds.has(a.id)),
    [availableAgents, selectedIds],
  )

  // ── Custom zones (lazy load) ───────────────────────────────
  const [customZones, setCustomZones] = useState<CustomZoneRow[]>([])
  useEffect(() => {
    listCustomZones().then((res) => {
      if (res.success) setCustomZones(res.data)
    })
  }, [])

  // For each agent, expand their zone codes (mix of zone + subzone) into
  // a flat set of subzone codes — what they actually cover.
  const agentSubzones = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const a of availableAgents) {
      map.set(a.id, new Set(expandToSubzones((a.zones ?? []) as string[])))
    }
    return map
  }, [availableAgents])

  /**
   * For each Zone, compute which agents cover *any* subzone of it
   * (whole-zone or partial). Used to render the share dialog grouping.
   */
  const agentsByZone = useMemo(() => {
    const map = new Map<ZoneCode, Profile[]>()
    for (const cat of CATEGORIES) {
      for (const z of cat.zones) map.set(z.code, [])
    }
    for (const a of availableAgents) {
      const covered = agentSubzones.get(a.id)!
      for (const cat of CATEGORIES) {
        for (const z of cat.zones) {
          if (z.subzones.some((s) => covered.has(s.code))) {
            map.get(z.code)!.push(a)
          }
        }
      }
    }
    return map
  }, [availableAgents, agentSubzones])

  /** Categories where at least one zone has agents — collapse the rest. */
  const populatedCategories = useMemo(() => {
    return CATEGORIES
      .map((cat) => {
        const zones = cat.zones
          .map((z) => ({
            ...z,
            agents: agentsByZone.get(z.code) ?? [],
          }))
          .filter((z) => z.agents.length > 0)
        return { ...cat, zones }
      })
      .filter((c) => c.zones.length > 0)
  }, [agentsByZone])

  /** Group available agents by each custom zone code. */
  const customZoneAgents = useMemo(() => {
    return customZones
      .map((cz) => ({
        ...cz,
        agents: availableAgents.filter((a) =>
          ((a.zones ?? []) as string[]).includes(cz.code),
        ),
      }))
      .filter((cz) => cz.agents.length > 0)
  }, [customZones, availableAgents])

  /** Categories the user can navigate (accordion state). */
  const [openCategories, setOpenCategories] = useState<Set<CategoryCode>>(new Set())
  function toggleCategoryOpen(code: CategoryCode) {
    setOpenCategories((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else                next.add(code)
      return next
    })
  }

  // Filtered list for the popover. With no query, show the full
  // network so a focused-but-empty input reveals options — same UX as
  // a Gmail-style "To:" picker.
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return availableAgents
    return availableAgents.filter((a) => {
      const hay = `${a.full_name} ${a.email ?? ""}`.toLowerCase()
      return hay.includes(q)
    })
  }, [availableAgents, query])

  function toggleAgent(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else              next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(availableAgents.map((a) => a.id)))
  }

  function clearAll() {
    setSelectedIds(new Set())
  }

  /**
   * Additive selection used by the "Por zona" shortcuts.
   *
   * The zone shortcuts overlap heavily — the same agent typically
   * covers Oeste + Este + Norte — so the previous toggle behaviour
   * caused a click on the second zone to *remove* the agents the
   * first click added. Now the buttons only add; removal is done via
   * the chip X in the combobox above.
   */
  function selectAgents(agentList: Profile[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const a of agentList) next.add(a.id)
      return next
    })
  }

  async function handleShare() {
    if (selectedIds.size === 0) return
    setSubmitting(true)
    setError(null)

    const ids = Array.from(selectedIds)
    const results = await Promise.all(
      ids.map((agentId) =>
        shareProperty({
          property_id:      propertyId,
          shared_with:      agentId,
          commission_type:  commissionType,
          commission_value: Number(commissionSplit),
        }),
      ),
    )

    setSubmitting(false)

    const successes = results.filter((r) => r.success)
    const failures  = results.length - successes.length

    if (successes.length === 0) {
      const firstError = results.find((r) => !r.success)
      setError(!firstError?.success ? firstError?.error ?? "Error al compartir" : null)
      return
    }

    setShares((prev) => [
      ...prev,
      ...successes
        .filter((r) => r.success)
        .map((r) => ({
          ...r.data!,
          shared_with_profile: agents.find((a) => a.id === r.data!.shared_with)!,
        })),
    ])
    setSelectedIds(new Set())
    setQuery("")

    const word = successes.length === 1 ? "agente" : "agentes"
    toast.success(
      failures === 0
        ? `Compartido con ${successes.length} ${word}`
        : `Compartido con ${successes.length} ${word}, ${failures} fallaron`,
    )
    router.refresh()
  }

  function handleRevoke(shareId: string, agentName: string) {
    if (!confirm(`¿Quitar el acceso de ${agentName} a esta propiedad?`)) return
    setRevokingId(shareId)
    startTransition(async () => {
      const result = await revokeShare(shareId)
      setRevokingId(null)
      if (!result.success) {
        toast.error(result.error ?? "No se pudo revocar")
        return
      }
      setShares((prev) => prev.filter((s) => s.id !== shareId))
      toast.success(`Acceso de ${agentName} revocado`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      {/* ── Existing shares ─────────────────────────────────────── */}
      {shares.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Compartido con · {shares.length}
          </p>

          <div className="space-y-1">
            {shares.map((share) => {
              const agent = share.shared_with_profile
              return (
                <div
                  key={share.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/40 transition-colors"
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={agent.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {getInitials(agent.full_name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{agent.full_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {STATUS_ICON[share.status]}
                      <span className="text-xs text-muted-foreground capitalize">
                        {share.status}
                      </span>
                      {share.commission_value != null && (
                        <span className="text-xs text-muted-foreground font-numeric">
                          · {share.commission_value}
                          {share.commission_type === "percentage" ? "%" : " fijo"}
                        </span>
                      )}
                    </div>
                  </div>

                  {share.status !== "revoked" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => handleRevoke(share.id, agent.full_name)}
                      disabled={revokingId === share.id}
                      aria-label={`Revocar acceso de ${agent.full_name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only sm:not-sr-only sm:ml-1.5">
                        {revokingId === share.id ? "Revocando…" : "Revocar"}
                      </span>
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {shares.length > 0 && availableAgents.length > 0 && <Separator />}

      {/* ── Add new shares ──────────────────────────────────────── */}
      {availableAgents.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          {shares.length === 0
            ? "Aún no hay agentes en tu red."
            : "Ya compartiste con todos los agentes disponibles."}
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Añadir agentes
            </p>
            <button
              type="button"
              onClick={selectedIds.size === availableAgents.length ? clearAll : selectAll}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-foreground/70 underline underline-offset-4 decoration-primary decoration-2 transition-colors"
            >
              <UsersIcon className="h-3.5 w-3.5" />
              {selectedIds.size === availableAgents.length
                ? `Quitar todos`
                : `Toda mi red (${availableAgents.length})`}
            </button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Unified multi-select combobox: chips + inline search in
              the same field. Click anywhere on the wrapper focuses the
              text input; Backspace on an empty input drops the last
              chip (standard combobox UX). */}
          <div className="relative">
            <div
              role="group"
              onClick={() => inputRef.current?.focus()}
              className="flex flex-wrap items-center gap-1.5 min-h-12 px-2 py-1.5 rounded-lg border bg-background focus-within:border-foreground/40 transition-colors cursor-text"
            >
              {selectedAgents.map((agent) => (
                <span
                  key={agent.id}
                  className="inline-flex items-center gap-1.5 h-7 pl-1 pr-2 rounded-full bg-muted border text-xs"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={agent.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[9px]">
                      {getInitials(agent.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium truncate max-w-[140px]">
                    {agent.full_name}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleAgent(agent.id)
                    }}
                    aria-label={`Quitar ${agent.full_name}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <XMarkIcon className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => {
                  // Delay so a click on a result registers before the
                  // popover unmounts.
                  window.setTimeout(() => setSearchOpen(false), 120)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && query === "" && selectedAgents.length > 0) {
                    toggleAgent(selectedAgents[selectedAgents.length - 1].id)
                  }
                  if (e.key === "Escape") {
                    setQuery("")
                    setSearchOpen(false)
                    inputRef.current?.blur()
                  }
                }}
                placeholder={
                  selectedAgents.length === 0
                    ? `Buscar entre ${availableAgents.length} agente${availableAgents.length !== 1 ? "s" : ""}…`
                    : ""
                }
                className="flex-1 min-w-[140px] bg-transparent outline-none text-sm h-7 px-1 placeholder:text-muted-foreground"
              />
            </div>

            {/* Results — rendered inline below the input so the row
                count drives the height (no popover clipping, no
                z-index battles with the zone shortcuts below). Shows
                while typing OR while the input has focus. */}
            {searchOpen && (query.trim() !== "" || availableAgents.length > 0) && (
              <Command
                className="mt-2 rounded-lg border bg-card"
                shouldFilter={false}
              >
                <CommandList className="max-h-72">
                  {searchResults.length === 0 ? (
                    <CommandEmpty>
                      {query.trim() !== ""
                        ? `Sin resultados para "${query}"`
                        : "No quedan agentes para sumar."}
                    </CommandEmpty>
                  ) : (
                    <CommandGroup>
                      {searchResults.map((agent) => {
                        const checked = selectedIds.has(agent.id)
                        const zoneLabels = formatZoneList(agent.zones ?? [])
                        return (
                          <CommandItem
                            key={agent.id}
                            value={agent.id}
                            onMouseDown={(e) => {
                              // Prevent the input from blurring before
                              // the selection registers — onBlur fires
                              // before onClick, which would close the
                              // popover and swallow the click.
                              e.preventDefault()
                            }}
                            onSelect={() => {
                              toggleAgent(agent.id)
                              setQuery("")
                              inputRef.current?.focus()
                            }}
                            className="gap-3 py-2"
                            data-checked={checked || undefined}
                          >
                            <span
                              className={cn(
                                "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                                checked
                                  ? "bg-primary border-primary"
                                  : "bg-background border-input",
                              )}
                            >
                              {checked && (
                                <svg
                                  viewBox="0 0 12 12"
                                  className="h-3 w-3 text-primary-foreground"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M2 6l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </span>
                            <Avatar className="h-7 w-7 shrink-0">
                              <AvatarImage src={agent.avatar_url ?? undefined} />
                              <AvatarFallback className="text-[10px]">
                                {getInitials(agent.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {agent.full_name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {zoneLabels || agent.email || ""}
                              </p>
                            </div>
                            {(agent.role === "super_admin" || agent.role === "owner_admin") && (
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {agent.role === "super_admin" ? "Super admin" : "Admin"}
                              </Badge>
                            )}
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            )}
          </div>

          {/* Zone shortcuts — accordion by category */}
          {query.trim() === "" && (populatedCategories.length > 0 || customZoneAgents.length > 0) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Por zona
                </p>
                <span className="text-[10px] text-muted-foreground/70">
                  toca una zona para seleccionar sus agentes
                </span>
              </div>

              <div className="space-y-2">
                {populatedCategories.map((cat) => {
                  const isOpen = openCategories.has(cat.code)
                  const allCatAgents = Array.from(
                    new Set(cat.zones.flatMap((z) => z.agents.map((a) => a.id))),
                  )
                    .map((id) => availableAgents.find((a) => a.id === id)!)
                  const allCatSelected = allCatAgents.every((a) => selectedIds.has(a.id))
                  return (
                    <div key={cat.code} className="rounded-lg border bg-card overflow-hidden">
                      {/* Category header */}
                      <div className="flex items-stretch">
                        <button
                          type="button"
                          onClick={() => toggleCategoryOpen(cat.code)}
                          className="flex-1 flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors min-w-0"
                        >
                          <ChevronDownIcon
                            className={cn(
                              "h-4 w-4 text-muted-foreground transition-transform shrink-0",
                              !isOpen && "-rotate-90",
                            )}
                          />
                          <span className="text-sm font-heading font-semibold truncate">
                            {cat.label}
                          </span>
                          <div className="flex -space-x-1.5 ml-auto">
                            {allCatAgents.slice(0, 4).map((a) => (
                              <Avatar key={a.id} className="h-5 w-5 ring-2 ring-background">
                                <AvatarImage src={a.avatar_url ?? undefined} />
                                <AvatarFallback className="text-[8px]">
                                  {getInitials(a.full_name)}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {allCatAgents.length > 4 && (
                              <span className="h-5 w-5 rounded-full ring-2 ring-background bg-muted flex items-center justify-center text-[8px] font-medium font-numeric text-muted-foreground">
                                +{allCatAgents.length - 4}
                              </span>
                            )}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => selectAgents(allCatAgents)}
                          className={cn(
                            "px-3 border-l text-xs font-medium transition-colors",
                            allCatSelected
                              ? "bg-primary/15 text-foreground"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                          )}
                          aria-label={`Seleccionar todos en ${cat.label}`}
                        >
                          {allCatSelected ? "Quitar" : "Toda"}
                        </button>
                      </div>

                      {/* Zones inside the category */}
                      {isOpen && (
                        <div className="border-t divide-y bg-muted/10">
                          {cat.zones.map((z) => {
                            const allSelected = z.agents.every((a) => selectedIds.has(a.id))
                            const someSelected = !allSelected && z.agents.some((a) => selectedIds.has(a.id))
                            return (
                              <button
                                key={z.code}
                                type="button"
                                onClick={() => selectAgents(z.agents)}
                                className={cn(
                                  "w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors",
                                  allSelected && "bg-primary/5",
                                )}
                              >
                                <span
                                  className={cn(
                                    "h-7 w-7 rounded-md flex items-center justify-center shrink-0 transition-colors",
                                    allSelected
                                      ? "bg-primary text-primary-foreground"
                                      : someSelected
                                        ? "bg-primary/15 text-foreground"
                                        : "bg-muted text-muted-foreground",
                                  )}
                                >
                                  {allSelected ? (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  ) : (
                                    <MapPinIcon className="h-3.5 w-3.5" />
                                  )}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-baseline justify-between gap-2">
                                    <p className="text-sm font-medium truncate">
                                      {z.shortLabel}
                                    </p>
                                    <span className="text-[10px] font-numeric text-muted-foreground shrink-0">
                                      {z.agents.length} {z.agents.length === 1 ? "agente" : "agentes"}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    {z.subzones.slice(0, 4).map((s) => s.label).join(" · ")}
                                    {z.subzones.length > 4 && " · …"}
                                  </p>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Custom zones */}
                {customZoneAgents.length > 0 && (
                  <div className="rounded-lg border bg-card overflow-hidden">
                    <div className="px-3 py-2 bg-muted/30 border-b">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Zonas personalizadas
                      </p>
                    </div>
                    <div className="divide-y">
                      {customZoneAgents.map((cz) => {
                        const allSelected = cz.agents.every((a) => selectedIds.has(a.id))
                        return (
                          <button
                            key={cz.code}
                            type="button"
                            onClick={() => selectAgents(cz.agents)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors",
                              allSelected && "bg-primary/5",
                            )}
                          >
                            <span className={cn(
                              "h-7 w-7 rounded-md flex items-center justify-center shrink-0",
                              allSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                            )}>
                              {allSelected ? <CheckCircle2 className="h-3.5 w-3.5" /> : <MapPinIcon className="h-3.5 w-3.5" />}
                            </span>
                            <span className="flex-1 text-sm font-medium truncate">{cz.label}</span>
                            <span className="text-[10px] font-numeric text-muted-foreground shrink-0">
                              {cz.agents.length}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Commission */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tipo de comisión</Label>
              <Select
                value={commissionType}
                onValueChange={(v) => v && setCommissionType(v as "percentage" | "fixed")}
              >
                <SelectTrigger>
                  <SelectValue>
                    {(v: unknown) =>
                      typeof v === "string" && (v === "percentage" || v === "fixed")
                        ? COMMISSION_TYPE_LABELS[v]
                        : "Porcentaje"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Porcentaje</SelectItem>
                  <SelectItem value="fixed">Monto fijo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {commissionType === "percentage" ? "Split %" : "Monto"}
              </Label>
              <Input
                type="number"
                min="0"
                max={commissionType === "percentage" ? "100" : undefined}
                value={commissionSplit}
                onChange={(e) => setCommissionSplit(e.target.value)}
                placeholder={commissionType === "percentage" ? "50" : "5000"}
              />
            </div>
          </div>

          <Button
            onClick={handleShare}
            disabled={selectedIds.size === 0 || submitting}
            className="w-full"
          >
            {submitting
              ? "Compartiendo…"
              : selectedIds.size === 0
                ? "Seleccioná agentes para compartir"
                : `Compartir con ${selectedIds.size} agente${selectedIds.size !== 1 ? "s" : ""}`}
          </Button>
        </div>
      )}
    </div>
  )
}
