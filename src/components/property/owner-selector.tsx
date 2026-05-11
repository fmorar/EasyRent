"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { searchOwners, createOwner } from "@/lib/actions/owner.actions"
import {
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
  UserIcon,
  CheckIcon,
} from "@heroicons/react/24/outline"
import type { Owner } from "@/types"

interface Props {
  value:          string | null        // owner_id
  onChange:       (id: string | null) => void
  onOwnerSelect?: (owner: Owner | null) => void  // exposes full object for live preview
  initial?:       Owner | null         // pre-loaded owner for edit mode
}

export function OwnerSelector({ value, onChange, onOwnerSelect, initial }: Props) {
  const [query,      setQuery]      = useState("")
  const [results,    setResults]    = useState<Owner[]>([])
  const [selected,   setSelected]   = useState<Owner | null>(initial ?? null)
  const [showSearch, setShowSearch] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [isPending,  startTransition] = useTransition()
  const searchRef = useRef<HTMLDivElement>(null)

  // New owner form state
  const [newName,     setNewName]     = useState("")
  const [newPhone,    setNewPhone]    = useState("")
  const [newEmail,    setNewEmail]    = useState("")
  const [newIdNumber, setNewIdNumber] = useState("")
  const [newNotes,    setNewNotes]    = useState("")
  const [createError, setCreateError] = useState("")

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false)
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [])

  function handleSearch(q: string) {
    setQuery(q)
    if (!q.trim()) { setResults([]); return }
    startTransition(async () => {
      const owners = await searchOwners(q)
      setResults(owners)
    })
  }

  function handleSelect(owner: Owner) {
    setSelected(owner)
    onChange(owner.id)
    onOwnerSelect?.(owner)
    setShowSearch(false)
    setQuery("")
    setResults([])
  }

  function handleClear() {
    setSelected(null)
    onChange(null)
    onOwnerSelect?.(null)
  }

  async function handleCreate() {
    if (!newName.trim()) { setCreateError("El nombre es requerido"); return }
    setCreateError("")
    startTransition(async () => {
      const result = await createOwner({
        full_name: newName,
        phone:     newPhone  || null,
        email:     newEmail  || null,
        id_number: newIdNumber || null,
        notes:     newNotes  || null,
      })
      if (!result.success) {
        setCreateError(result.error)
        toast.error(result.error ?? "Error al crear dueño")
        return
      }
      toast.success(`Dueño "${result.data.full_name}" creado`)
      handleSelect(result.data)
      setShowCreate(false)
      setNewName(""); setNewPhone(""); setNewEmail(""); setNewIdNumber(""); setNewNotes("")
    })
  }

  return (
    <div className="space-y-3">
      <Label>Dueño de la propiedad</Label>

      {/* Selected owner display */}
      {selected ? (
        <div className="flex items-center justify-between border rounded-lg px-4 py-3 bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <UserIcon className="h-4 w-4 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">{selected.full_name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {selected.phone && (
                  <span className="text-xs text-muted-foreground">{selected.phone}</span>
                )}
                {selected.email && (
                  <span className="text-xs text-muted-foreground">{selected.email}</span>
                )}
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground"
          >
            <XMarkIcon className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1 justify-start text-muted-foreground font-normal"
            onClick={() => { setShowSearch(true); setShowCreate(false) }}
          >
            <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
            Buscar dueño existente…
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => { setShowCreate(!showCreate); setShowSearch(false) }}
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Nuevo
          </Button>
        </div>
      )}

      {/* Search dropdown */}
      {showSearch && (
        <div ref={searchRef} className="border rounded-lg shadow-sm bg-background p-3 space-y-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar por nombre…"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {isPending && (
            <p className="text-xs text-muted-foreground px-1">Buscando…</p>
          )}
          {!isPending && results.length === 0 && query.trim() && (
            <p className="text-xs text-muted-foreground px-1">Sin resultados para &ldquo;{query}&rdquo;</p>
          )}
          {results.map((owner) => (
            <button
              key={owner.id}
              type="button"
              onClick={() => handleSelect(owner)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted text-left text-sm"
            >
              <div>
                <p className="font-medium">{owner.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {[owner.phone, owner.email].filter(Boolean).join(" · ")}
                </p>
              </div>
              {value === owner.id && <CheckIcon className="h-4 w-4 text-foreground" />}
            </button>
          ))}
        </div>
      )}

      {/* Create new owner form */}
      {showCreate && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Nuevo dueño</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowCreate(false)}
            >
              <XMarkIcon className="h-4 w-4" />
            </Button>
          </div>
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs">Nombre completo *</Label>
              <Input
                placeholder="Nombre completo"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Teléfono</Label>
              <Input
                placeholder="+506 8888 8888"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Correo electrónico</Label>
              <Input
                type="email"
                placeholder="correo@ejemplo.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cédula / Pasaporte</Label>
              <Input
                placeholder="1-2345-6789"
                value={newIdNumber}
                onChange={(e) => setNewIdNumber(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs">Notas internas</Label>
              <Textarea
                placeholder="Observaciones, preferencias, etc."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                rows={2}
                disabled={isPending}
                className="resize-none"
              />
            </div>
          </div>
          {createError && (
            <p className="text-xs text-destructive">{createError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowCreate(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCreate}
              disabled={isPending}
            >
              {isPending ? "Guardando…" : "Crear dueño"}
            </Button>
          </div>
        </div>
      )}

      {selected && (
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-xs font-normal">
            {selected.id_number ? `Cédula: ${selected.id_number}` : "Sin cédula registrada"}
          </Badge>
          {selected.notes && (
            <span className="text-xs text-muted-foreground truncate max-w-[240px]">
              {selected.notes}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
