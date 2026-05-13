"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Alert } from "@/components/ui/alert"
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  PropertySelector, type PropertyOption,
} from "@/components/market-analysis/property-selector"
import { ChevronUpDownIcon, CheckIcon, PlusIcon } from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils"
import { createManualLead } from "@/lib/actions/lead.actions"

export interface LeadOption {
  id:        string
  full_name: string
  email:     string | null
  phone:     string | null
}

interface Props {
  properties: PropertyOption[]
  leads:      LeadOption[]
}

/**
 * Single-step wizard. The user picks a property and (optionally) a
 * lead/tenant; everything else is filled by the prefill service on
 * the server. The user lands on `/contracts/[id]` with the structured
 * forms ready to be reviewed and completed.
 *
 * Why single-step: the spec describes a multi-step wizard but every
 * subsequent "step" (property legal details, payment terms, etc.) is
 * really progressive disclosure of the SAME structured data — once
 * the contract row exists, those sections live in the editor's right
 * rail. Forcing the user through 5 steps before they see anything
 * substantive is friction without value at MVP scope.
 */
export function NewContractWizard({ properties, leads: initialLeads }: Props) {
  const t      = useTranslations("contracts.wizard")
  const router = useRouter()

  // Leads list lives in local state so the manual-create dialog can
  // append a freshly-created lead and auto-select it without a round
  // trip to the server.
  const [leads,      setLeads]      = useState<LeadOption[]>(initialLeads)
  const [propertyId, setPropertyId] = useState<string | null>(null)
  const [leadId,     setLeadId]     = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [pending,    startTransition] = useTransition()

  function handleLeadCreated(lead: LeadOption) {
    setLeads((prev) => [lead, ...prev])
    setLeadId(lead.id)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!propertyId) {
      setError(t("propertyRequired"))
      return
    }
    startTransition(async () => {
      const res = await fetch("/api/contracts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          property_id: propertyId,
          lead_id:     leadId,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        const msg = j?.error ?? t("submitError")
        setError(msg)
        toast.error(msg)
        return
      }
      const { id } = await res.json()
      toast.success(t("created"))
      router.push(`/contracts/${id}`)
    })
  }

  return (
    <form onSubmit={submit} className="space-y-(--spacing-section)">
      {error && (
        <Alert variant="destructive">
          <p className="text-sm">{error}</p>
        </Alert>
      )}

      <Card className="p-4 sm:p-5 lg:p-6 space-y-(--spacing-cluster)">
        <header className="space-y-1">
          <h2 className="text-base font-heading font-semibold">
            {t("section1Title")}
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("section1Desc")}
          </p>
        </header>
        <PropertySelector
          properties={properties}
          value={propertyId}
          onChange={(id) => setPropertyId(id)}
        />
      </Card>

      <Card className="p-4 sm:p-5 lg:p-6 space-y-(--spacing-cluster)">
        <header className="space-y-1">
          <h2 className="text-base font-heading font-semibold">
            {t("section2Title")}
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("section2Desc")}
          </p>
        </header>
        <TenantSelector
          leads={leads}
          value={leadId}
          onChange={setLeadId}
          onLeadCreated={handleLeadCreated}
        />
      </Card>

      <div className="pt-2">
        <Button type="submit" disabled={pending || !propertyId} size="lg" className="w-full sm:w-auto">
          {pending ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────
// TenantSelector — Combobox over leads. Local to the wizard since
// it's narrowly scoped (search by name/email/phone). Also exposes
// a "+ Crear nuevo" CTA that opens an inline dialog for agents who
// have an arrendatario in mind but haven't captured them as a lead.
function TenantSelector({
  leads, value, onChange, onLeadCreated,
}: {
  leads: LeadOption[]
  value: string | null
  onChange: (id: string | null) => void
  onLeadCreated: (lead: LeadOption) => void
}) {
  const t = useTranslations("contracts.wizard")
  const [open,       setOpen]       = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search,     setSearch]     = useState("")
  const selected = leads.find((l) => l.id === value) ?? null

  function openCreateDialog() {
    setOpen(false)
    setDialogOpen(true)
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              aria-expanded={open}
              className="w-full justify-between h-auto py-3 px-3"
            >
              <span className="flex flex-col items-start min-w-0 flex-1">
                <span className={cn("text-sm truncate", !selected && "text-muted-foreground")}>
                  {selected?.full_name ?? t("tenantPlaceholder")}
                </span>
                {selected?.email && (
                  <span className="text-xs text-muted-foreground truncate">
                    {selected.email}
                  </span>
                )}
              </span>
              <ChevronUpDownIcon className="h-4 w-4 opacity-50 shrink-0" />
            </Button>
          }
        />
        <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
          <Command>
            <CommandInput
              placeholder={t("tenantSearchPlaceholder")}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {/* When no matches, surface a clear path forward instead
                  of a dead "no se encontraron leads" message. */}
              <CommandEmpty>
                <div className="px-3 py-4 text-center space-y-2">
                  <p className="text-sm text-muted-foreground">{t("tenantEmpty")}</p>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={openCreateDialog}
                  >
                    <PlusIcon className="h-4 w-4 mr-1.5" />
                    {t("tenantCreateNew")}
                  </Button>
                </div>
              </CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__create__"
                  onSelect={openCreateDialog}
                  className="text-primary data-[selected=true]:text-primary"
                >
                  <PlusIcon className="mr-2 h-4 w-4 shrink-0" />
                  <span className="text-sm font-medium">{t("tenantCreateNew")}</span>
                </CommandItem>
                <CommandItem
                  value="__none__"
                  onSelect={() => { onChange(null); setOpen(false) }}
                >
                  <span className="text-muted-foreground">{t("tenantNone")}</span>
                </CommandItem>
                {leads.map((lead) => (
                  <CommandItem
                    key={lead.id}
                    value={`${lead.full_name} ${lead.email ?? ""} ${lead.phone ?? ""}`}
                    onSelect={() => {
                      onChange(lead.id)
                      setOpen(false)
                    }}
                  >
                    <CheckIcon
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === lead.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{lead.full_name}</p>
                      {(lead.email || lead.phone) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {[lead.email, lead.phone].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <ManualLeadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialName={search}
        onCreated={(lead) => {
          onLeadCreated(lead)
          setDialogOpen(false)
          setSearch("")
        }}
      />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────
// ManualLeadDialog — minimal form for capturing a tenant that
// isn't already in the leads pipeline. Persists the lead so the
// arrendatario shows up in /leads afterwards (not a contract-only
// scratch record).
function ManualLeadDialog({
  open, onOpenChange, initialName, onCreated,
}: {
  open:         boolean
  onOpenChange: (next: boolean) => void
  initialName:  string
  onCreated:    (lead: LeadOption) => void
}) {
  const t = useTranslations("contracts.wizard")
  const [fullName, setFullName] = useState(initialName)
  const [email,    setEmail]    = useState("")
  const [phone,    setPhone]    = useState("")
  const [pending,  startTransition] = useTransition()
  const [error,    setError]    = useState<string | null>(null)

  // Reset form when the dialog (re)opens so stale state from a
  // previous attempt doesn't leak in. Tie to `open` so the initial
  // name carried over from the combobox search is respected.
  function handleOpenChange(next: boolean) {
    if (next) {
      setFullName(initialName)
      setEmail("")
      setPhone("")
      setError(null)
    }
    onOpenChange(next)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    // The Dialog renders via portal, but React's synthetic event
    // bubbling follows the component tree — so the inner submit would
    // also fire the wizard's outer onSubmit handler, kicking off
    // "Generar borrador" with lead_id=null BEFORE this server action
    // had a chance to create the lead. Stop the bubble here.
    e.stopPropagation()
    setError(null)
    const trimmed = fullName.trim()
    if (!trimmed) {
      setError(t("tenantNameRequired"))
      return
    }
    startTransition(async () => {
      const res = await createManualLead({
        full_name: trimmed,
        email:     email.trim() || undefined,
        phone:     phone.trim() || undefined,
      })
      if (!res.success) {
        setError(res.error)
        toast.error(res.error)
        return
      }
      toast.success(t("tenantCreated"))
      onCreated({
        id:        res.data.id,
        full_name: res.data.full_name,
        email:     res.data.email,
        phone:     res.data.phone,
      })
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("tenantDialogTitle")}</DialogTitle>
          <DialogDescription>{t("tenantDialogDesc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <p className="text-sm">{error}</p>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="manual-lead-name">{t("tenantNameLabel")}</Label>
            <Input
              id="manual-lead-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t("tenantNamePlaceholder")}
              autoFocus
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-lead-email">{t("tenantEmailLabel")}</Label>
            <Input
              id="manual-lead-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@correo.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-lead-phone">{t("tenantPhoneLabel")}</Label>
            <Input
              id="manual-lead-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+506 0000 0000"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              {t("tenantDialogCancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("tenantDialogSubmitting") : t("tenantDialogSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
