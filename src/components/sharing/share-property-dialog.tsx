"use client"

import { useState, useEffect, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Separator } from "@/components/ui/separator"
import { ShareDialog } from "@/components/sharing/share-dialog"
import { ShareLinkRow } from "@/components/sharing/share-link-row"
import { SharePanel } from "@/components/sharing/share-panel"
import {
  GlobeAltIcon,
  EyeSlashIcon,
  UsersIcon,
} from "@heroicons/react/24/outline"
import { getPropertyShareData } from "@/lib/actions/share.actions"
import { trackEvent } from "@/lib/analytics/track"
import {
  generateAnonymousSlug,
  revokeAnonymousSlug,
  setPropertyMarketplaceVisible,
} from "@/lib/actions/property.actions"
import type { PropertyShare, Profile } from "@/types"

interface Props {
  /** Property core data. */
  propertyId:           string
  propertyTitle:        string
  propertySlug:         string
  isMarketplaceVisible: boolean
  /** Initial value of the unbranded slug; toggles update this locally. */
  initialAnonymousSlug?: string | null
  /**
   * Display mode:
   *  - `"owner"`: full panel — public link + unbranded link + collaborators.
   *    Requires the viewer to own (or admin) the property.
   *  - `"public"`: just the public link + native share buttons.
   */
  mode?:                "owner" | "public"
  /** Optional trigger override. */
  children?:            React.ReactNode
  /** Controlled open state (for `?share=1`). */
  open?:                boolean
  onOpenChange?:        (open: boolean) => void
}

/**
 * Property share modal — composes ShareDialog + the property-specific link
 * rows + (in owner mode) the collaborators panel.
 */
export function SharePropertyDialog({
  propertyId,
  propertyTitle,
  propertySlug,
  isMarketplaceVisible,
  initialAnonymousSlug = null,
  mode = "owner",
  children,
  open: controlledOpen,
  onOpenChange,
}: Props) {
  const t = useTranslations("shareDialog")
  const [internalOpen, setInternalOpen] = useState(false)
  const open    = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  // ── Marketplace visibility local state ─────────────────────────
  const [marketplaceOn,    setMarketplaceOn]    = useState(isMarketplaceVisible)
  const [togglingMarket,   setTogglingMarket]   = useState(false)

  async function toggleMarketplace() {
    if (togglingMarket) return
    setTogglingMarket(true)
    const next   = !marketplaceOn
    const result = await setPropertyMarketplaceVisible(propertyId, next)
    setTogglingMarket(false)
    if (!result.success) {
      toast.error(result.error ?? t("publishError"))
      return
    }
    setMarketplaceOn(next)
    toast.success(next ? t("publishedToast") : t("unpublishedToast"))
  }

  // ── Anonymous slug local state ───────────────────────────────────
  const [anonymousSlug, setAnonymousSlug] = useState<string | null>(initialAnonymousSlug)
  const [togglingAnon,  setTogglingAnon]  = useState(false)

  async function toggleAnonymous() {
    if (togglingAnon) return
    setTogglingAnon(true)

    if (anonymousSlug) {
      const result = await revokeAnonymousSlug(propertyId)
      setTogglingAnon(false)
      if (!result.success) {
        toast.error(result.error ?? "No pudimos actualizar")
        return
      }
      setAnonymousSlug(null)
      toast.success("Link sin marca desactivado")
    } else {
      const result = await generateAnonymousSlug(propertyId)
      setTogglingAnon(false)
      if (!result.success) {
        toast.error(result.error ?? "No se pudo actualizar")
        return
      }
      setAnonymousSlug(result.data.anonymous_slug)
      toast.success("Link sin marca generado")
    }
  }

  // ── Collaborators data (lazy-loaded on open in owner mode) ───────
  const [shares, setShares] = useState<(PropertyShare & { shared_with_profile: Profile })[] | null>(null)
  const [agents, setAgents] = useState<Profile[] | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (!open || mode !== "owner") return
    startTransition(async () => {
      const result = await getPropertyShareData(propertyId)
      if (!result.success) {
        toast.error(result.error ?? t("loading"))
        setOpen(false)
        return
      }
      setShares(result.data.shares)
      setAgents(result.data.agents)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, propertyId, mode])

  // ── URL building ─────────────────────────────────────────────────
  const origin     = typeof window !== "undefined" ? window.location.origin : ""
  const publicUrl  = marketplaceOn ? `${origin}/p/${propertySlug}` : null
  const anonUrl    = anonymousSlug ? `${origin}/p/a/${anonymousSlug}` : null

  // ── Body composition ─────────────────────────────────────────────
  const body = (
    <div className="space-y-5">
      {/* Public branded link — switch publishes the property to the
          marketplace AND surfaces the public URL row to copy/share. */}
      <ShareLinkRow
        icon={<GlobeAltIcon />}
        tone="success"
        title={t("publicLinkTitle")}
        description={publicUrl ? t("publicLinkActive") : t("publicLinkInactive")}
        url={publicUrl}
        onCopy={() => trackEvent({
          property_id: propertyId,
          event_type:  "share_clicked",
          source:      "share_dialog_branded",
          metadata:    { channel: "copy_link" },
        })}
        control={mode === "owner" ? (
          <button
            type="button"
            role="switch"
            aria-checked={marketplaceOn}
            aria-label={t("publishToggleAria")}
            onClick={toggleMarketplace}
            disabled={togglingMarket}
            className={[
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-50",
              marketplaceOn ? "bg-primary" : "bg-input",
            ].join(" ")}
          >
            <span
              className={[
                "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-sm ring-0 transition-transform duration-200",
                marketplaceOn ? "translate-x-4" : "translate-x-0",
              ].join(" ")}
            />
          </button>
        ) : undefined}
      />

      {mode === "owner" && (
        <>
          <Separator />

          {/* Unbranded / anonymous link */}
          <ShareLinkRow
            icon={<EyeSlashIcon />}
            tone="muted"
            title={t("anonLinkTitle")}
            description={t("anonLinkDesc")}
            url={anonUrl}
            onCopy={() => trackEvent({
              property_id: propertyId,
              event_type:  "share_clicked",
              source:      "share_dialog_anonymous",
              metadata:    { channel: "copy_link" },
            })}
            control={
              <button
                type="button"
                role="switch"
                aria-checked={!!anonymousSlug}
                aria-label="Activar link sin marca"
                onClick={toggleAnonymous}
                disabled={togglingAnon}
                className={[
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-50",
                  anonymousSlug ? "bg-primary" : "bg-input",
                ].join(" ")}
              >
                <span
                  className={[
                    "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-sm ring-0 transition-transform duration-200",
                    anonymousSlug ? "translate-x-4" : "translate-x-0",
                  ].join(" ")}
                />
              </button>
            }
          />

          <Separator />

          {/* Collaborators */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/15 text-foreground [&>svg]:h-4 [&>svg]:w-4">
                <UsersIcon />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t("collaboratorsTitle")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("collaboratorsDesc")}
                </p>
              </div>
            </div>

            <div className="pl-12">
              {shares === null || agents === null ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t("loading")}
                </p>
              ) : (
                <SharePanel
                  propertyId={propertyId}
                  shares={shares}
                  agents={agents}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )

  return (
    <ShareDialog
      title={`Compartir "${propertyTitle}"`}
      description={mode === "public" ? t("publicModeDesc") : undefined}
      open={open}
      onOpenChange={setOpen}
      body={body}
      maxWidth={mode === "public" ? "lg" : "3xl"}
    >
      {children}
    </ShareDialog>
  )
}
