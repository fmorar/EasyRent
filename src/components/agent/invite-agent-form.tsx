"use client"

import { useState, useTransition, useEffect } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert } from "@/components/ui/alert"
import {
  ClipboardIcon,
  CheckCircleIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline"
import { inviteAgent } from "@/lib/actions/invitation.actions"
import { listCustomZones, createCustomZone, type CustomZoneRow } from "@/lib/actions/zones.actions"
import { ZonesPicker } from "@/components/shared/zones-picker"
import { formatZoneList } from "@/lib/zones"

interface Props {
  /** Whether the current user is an owner_admin (controls role-select visibility). */
  isAdmin: boolean
  /** App base URL used to compose the invite link to copy. */
  appUrl:  string
}

export function InviteAgentForm({ isAdmin, appUrl }: Props) {
  const t = useTranslations("inviteAgent")

  const [email, setEmail] = useState("")
  const [role,  setRole]  = useState<"agent" | "owner_admin">("agent")
  const [zones, setZones] = useState<string[]>([])
  const [token, setToken] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  const ROLE_OPTIONS = [
    { value: "agent",       label: t("roleAgent") },
    { value: "owner_admin", label: t("roleAdmin") },
  ]

  // Custom zones — lazy-load on mount
  const [customZones, setCustomZones] = useState<CustomZoneRow[]>([])
  useEffect(() => {
    listCustomZones().then((res) => {
      if (res.success) setCustomZones(res.data)
    })
  }, [])

  async function handleCreateCustomZone(label: string) {
    const res = await createCustomZone(label)
    if (!res.success) {
      toast.error(res.error ?? t("zoneCreateError"))
      return
    }
    setCustomZones((prev) =>
      prev.find((z) => z.code === res.data.code) ? prev : [...prev, res.data],
    )
    if (!zones.includes(res.data.code)) setZones((prev) => [...prev, res.data.code])
    toast.success(t("zoneCreatedToast", { label: res.data.label }))
  }

  const inviteUrl = token ? `${appUrl}/invite/${token}` : null

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    if (!email.trim()) {
      setServerError(t("errorEmailRequired"))
      return
    }
    if (zones.length === 0) {
      setServerError(t("errorZonesRequired"))
      return
    }
    startTransition(async () => {
      const result = await inviteAgent({ email: email.trim(), role, zones })
      if (!result.success) {
        setServerError(result.error ?? t("errorGeneric"))
        toast.error(result.error ?? t("errorGeneric"))
        return
      }
      setToken(result.data.token)
      toast.success(t("createdToast"))
    })
  }

  function copyLink() {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    toast.success(t("linkCopiedToast"))
    setTimeout(() => setCopied(false), 3000)
  }

  function reset() {
    setEmail("")
    setZones([])
    setToken(null)
    setCopied(false)
    setServerError(null)
  }

  // ── Success state ────────────────────────────────────────────
  if (inviteUrl) {
    const zonesLabel = formatZoneList(zones)
    return (
      <div className="rounded-2xl border bg-card p-6 sm:p-8 space-y-(--spacing-block)">
        <div className="flex items-start gap-(--spacing-cluster)">
          <span className="h-10 w-10 rounded-full bg-success-soft text-success flex items-center justify-center shrink-0">
            <CheckCircleIcon className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-lg font-heading font-semibold">{t("successTitle")}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t.rich("successBody", {
                email,
                bold: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
              })}
            </p>
            {zonesLabel && (
              <p className="text-xs text-muted-foreground mt-1">
                {t("zonesAssigned")}{" "}
                <span className="font-medium text-foreground">{zonesLabel}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2">
          <code className="flex-1 text-xs font-mono truncate px-2">
            {inviteUrl}
          </code>
          <Button
            type="button"
            size="sm"
            variant={copied ? "secondary" : "default"}
            onClick={copyLink}
            className="shrink-0"
          >
            {copied ? (
              <><CheckCircleIcon className="h-4 w-4 mr-1.5" />{t("copied")}</>
            ) : (
              <><ClipboardIcon className="h-4 w-4 mr-1.5" />{t("copyLink")}</>
            )}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <p className="text-xs text-muted-foreground">
            {t("noEmailHint")}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={reset}>
            {t("inviteAnother")}
          </Button>
        </div>
      </div>
    )
  }

  // ── Form state ───────────────────────────────────────────────
  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border bg-card p-6 sm:p-8 space-y-(--spacing-block) max-w-2xl"
      noValidate
    >
      {serverError && (
        <Alert variant="destructive">
          <p className="text-sm">{serverError}</p>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="invite-email">{t("emailLabel")}</Label>
        <div className="relative">
          <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id="invite-email"
            type="email"
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
            required
            autoFocus
            className="pl-9 h-11"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {t("emailHint")}
        </p>
      </div>

      {isAdmin && (
        <div className="space-y-1.5">
          <Label htmlFor="invite-role">{t("roleLabel")}</Label>
          <Select
            value={role}
            onValueChange={(v) => v && setRole(v as "agent" | "owner_admin")}
          >
            <SelectTrigger id="invite-role" className="h-11">
              <SelectValue>
                {(v: unknown) =>
                  ROLE_OPTIONS.find((o) => o.value === v)?.label ?? t("roleAgent")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Zone assignment — required */}
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <Label>{t("zonesLabel")}</Label>
          <span className="text-[11px] text-muted-foreground">
            {zones.length === 0
              ? t("selectAtLeastOne")
              : zones.length === 1
                ? t("selectedOne", { count: zones.length })
                : t("selectedMany", { count: zones.length })}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("zonesHint")}
        </p>
        <div className="rounded-lg border bg-muted/20 p-3 max-h-80 overflow-y-auto">
          <ZonesPicker
            value={zones}
            onChange={setZones}
            customZones={customZones}
            onCreateCustomZone={handleCreateCustomZone}
            disabled={isPending}
          />
        </div>
      </div>

      <div className="pt-(--spacing-tight)">
        <Button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="w-full h-11"
        >
          {isPending ? t("submitGenerating") : t("submit")}
        </Button>
      </div>
    </form>
  )
}
