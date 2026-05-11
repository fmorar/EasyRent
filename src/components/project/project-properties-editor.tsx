"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { toast } from "sonner"
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  HomeIcon,
  PlusIcon,
} from "@heroicons/react/24/outline"
import {
  listProjectProperties,
  searchOwnPropertiesForProject,
  linkPropertyToProject,
  unlinkPropertyFromProject,
  type ProjectLinkedPropertyRow,
} from "@/lib/actions/project-media.actions"
import { formatPrice } from "@/lib/utils"

interface Props {
  projectId:        string
  initialLinked:    ProjectLinkedPropertyRow[]
}

const STATUS_LABELS: Record<string, string> = {
  available:  "En venta",
  reserved:   "Reservado",
  sold:       "Vendido",
  off_market: "Fuera de mercado",
}

export function ProjectPropertiesEditor({ projectId, initialLinked }: Props) {
  const [linked,      setLinked]      = useState<ProjectLinkedPropertyRow[]>(initialLinked)
  const [showPicker,  setShowPicker]  = useState(false)
  const [query,       setQuery]       = useState("")
  const [results,     setResults]     = useState<ProjectLinkedPropertyRow[]>([])
  const [isPending,   startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Search whenever the picker is open or the query changes
  useEffect(() => {
    if (!showPicker) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const result = await searchOwnPropertiesForProject(projectId, query)
        if (result.success) setResults(result.data)
        else toast.error(result.error ?? "Error al buscar propiedades")
      })
    }, 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPicker, query])

  function refreshLinked() {
    startTransition(async () => {
      const result = await listProjectProperties(projectId)
      if (result.success) setLinked(result.data)
    })
  }

  function add(property: ProjectLinkedPropertyRow) {
    // Optimistic
    setLinked((prev) => [property, ...prev])
    setResults((prev) => prev.filter((r) => r.id !== property.id))

    startTransition(async () => {
      const result = await linkPropertyToProject(projectId, property.id)
      if (!result.success) {
        toast.error(result.error ?? "No se pudo vincular la propiedad")
        refreshLinked()
        return
      }
      toast.success(`"${property.title}" vinculada al proyecto`)
    })
  }

  function remove(property: ProjectLinkedPropertyRow) {
    setLinked((prev) => prev.filter((p) => p.id !== property.id))

    startTransition(async () => {
      const result = await unlinkPropertyFromProject(property.id)
      if (!result.success) {
        toast.error(result.error ?? "No se pudo desvincular")
        refreshLinked()
        return
      }
      toast.success(`"${property.title}" desvinculada`)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Propiedades vinculadas</h3>
          <p className="text-sm text-muted-foreground">
            Las propiedades que vincules a este proyecto van a heredar
            automáticamente título, descripción, ubicación, amenidades y fotos.
          </p>
        </div>
        {!showPicker && (
          <button
            type="button"
            onClick={() => { setShowPicker(true); setQuery("") }}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border bg-background hover:bg-muted text-sm font-medium transition-colors shrink-0"
          >
            <PlusIcon className="h-4 w-4" />
            Agregar
          </button>
        )}
      </div>

      {/* Linked list */}
      {linked.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-3">
          Aún no hay propiedades vinculadas.
        </p>
      ) : (
        <ul className="space-y-2">
          {linked.map((p) => (
            <PropertyRow
              key={p.id}
              property={p}
              action={
                <button
                  type="button"
                  onClick={() => remove(p)}
                  disabled={isPending}
                  className="h-8 w-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors flex items-center justify-center shrink-0"
                  aria-label="Desvincular"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              }
            />
          ))}
        </ul>
      )}

      {/* Picker */}
      {showPicker && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar mis propiedades por título…"
                className="pl-9 pr-3 h-10 w-full rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="button"
              onClick={() => { setShowPicker(false); setQuery(""); setResults([]) }}
              className="h-10 px-3 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cerrar
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto -mx-4 px-4 divide-y">
            {isPending && results.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground text-center">Buscando…</p>
            )}
            {!isPending && results.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground text-center">
                {query.trim()
                  ? `Sin resultados para "${query}"`
                  : "No tenés propiedades disponibles para vincular."}
              </p>
            )}
            {results.map((p) => (
              <PropertyRow
                key={p.id}
                property={p}
                clickable
                action={
                  <button
                    type="button"
                    onClick={() => add(p)}
                    disabled={isPending}
                    className="h-8 px-3 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shrink-0"
                  >
                    Vincular
                  </button>
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Single row ─────────────────────────────────────────────────────
function PropertyRow({
  property, action, clickable,
}: {
  property:  ProjectLinkedPropertyRow
  action:    React.ReactNode
  clickable?: boolean
}) {
  return (
    <li className={`flex items-center gap-3 py-2.5 ${clickable ? "" : "px-3 rounded-lg border bg-card"}`}>
      <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted shrink-0 flex items-center justify-center">
        {property.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={property.cover_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <HomeIcon className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{property.title}</p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{STATUS_LABELS[property.status] ?? property.status}</span>
          {property.price != null && property.currency && (
            <>
              <span>·</span>
              <span className="tabular-nums">
                {formatPrice(property.price, property.currency)}
              </span>
            </>
          )}
          {property.display_address && (
            <>
              <span>·</span>
              <span className="truncate">{property.display_address}</span>
            </>
          )}
        </div>
      </div>
      {action}
    </li>
  )
}
