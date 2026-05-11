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
  PropertySelector, type PropertyOption,
} from "@/components/market-analysis/property-selector"
import { ChevronUpDownIcon, CheckIcon } from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils"

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
export function NewContractWizard({ properties, leads }: Props) {
  const t      = useTranslations("contracts.wizard")
  const router = useRouter()

  const [propertyId, setPropertyId] = useState<string | null>(null)
  const [leadId,     setLeadId]     = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [pending,    startTransition] = useTransition()

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
        <TenantSelector leads={leads} value={leadId} onChange={setLeadId} />
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
// it's narrowly scoped (search by name/email/phone).
function TenantSelector({
  leads, value, onChange,
}: {
  leads: LeadOption[]
  value: string | null
  onChange: (id: string | null) => void
}) {
  const t = useTranslations("contracts.wizard")
  const [open, setOpen] = useState(false)
  const selected = leads.find((l) => l.id === value) ?? null

  return (
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
          <CommandInput placeholder={t("tenantSearchPlaceholder")} />
          <CommandList>
            <CommandEmpty>{t("tenantEmpty")}</CommandEmpty>
            <CommandGroup>
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
  )
}
