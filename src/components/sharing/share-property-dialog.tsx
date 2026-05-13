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
  setPropertyMarketplaceVisible,
} from "@/lib/actions/property.actions"
import type { PropertyShare, Profile } from "@/types"

interface Props {
  /** Property core data. */
  propertyId:           string
  propertyTitle:        string
  propertySlug:         string
  isMarketplaceVisible: boolean
  /** Unbranded slug — always set on new properties (auto-generated at
   *  creation), backfilled on existing ones. The dialog renders the
   *  link as static + copy; there's no toggle. */
  initialAnonymousSlug?: string | null
  /** When true, the viewer owns the property and gets the full panel
   *  (marketplace toggle + collaborators). When false (a shared-with
   *  recipient), only the read-only link rows render so they can
   *  still copy and share via their own contact details. */
  canManage?:           boolean
  /** Slug of the agent who's currently viewing — when provided, the
   *  copied URLs include `?via=<slug>` so the listing routes leads
   *  to this agent instead of the platform's super_admin. */
  viaAgentSlug?:        string | null
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
  canManage = true,
  viaAgentSlug = null,
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

  // Unbranded link is auto-created on every property and always
  // available. No toggle — just a static row with copy. Owners and
  // shared-with recipients see the same link.
  const anonymousSlug = initialAnonymousSlug

  // ── Collaborators data (lazy-loaded on open in owner mode) ───────
  const [shares, setShares] = useState<(PropertyShare & { shared_with_profile: Profile })[] | null>(null)
  const [agents, setAgents] = useState<Profile[] | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (!open || !canManage) return
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
  }, [open, propertyId, canManage])

  // ── URL building ─────────────────────────────────────────────────
  // Recipients copying the branded URL should route the lead to
  // themselves (?via=<their-slug>), not the platform's super_admin.
  // The owner gets a plain link — leads on their own listings come
  // through the marketplace channel by default.
  const origin     = typeof window !== "undefined" ? window.location.origin : ""
  const viaSuffix  = viaAgentSlug ? `?via=${encodeURIComponent(viaAgentSlug)}` : ""
  const publicUrl  = marketplaceOn ? `${origin}/p/${propertySlug}${viaSuffix}` : null
  const anonUrl    = anonymousSlug ? `${origin}/p/a/${anonymousSlug}` : null

  // ── Body composition ─────────────────────────────────────────────
  const body = (
    <div className="space-y-5">
      {/* Public branded link — owner gets a toggle to publish to the
          marketplace; recipients see the URL once the owner has
          published. */}
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
        control={canManage ? (
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

      <Separator />

      {/* Unbranded link — auto-generated on every property, no toggle.
          Always shown so any agent (owner or share recipient) can copy
          and forward it to a prospect. */}
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
      />

      {canManage && (
        <>
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
      open={open}
      onOpenChange={setOpen}
      body={body}
      maxWidth={canManage ? "3xl" : "lg"}
    >
      {children}
    </ShareDialog>
  )
}
