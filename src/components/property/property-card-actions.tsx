"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  ArrowDownTrayIcon,
  ClipboardDocumentIcon,
  EllipsisVerticalIcon,
  PencilSquareIcon,
  ShareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { SharePropertyDialog } from "@/components/sharing/share-property-dialog"
import { deleteProperty } from "@/lib/actions/property.actions"
import { getSocialPostContent } from "@/lib/actions/social-post.actions"

interface Props {
  propertyId:           string
  propertyTitle:        string
  propertySlug:         string
  isMarketplaceVisible: boolean
  initialAnonymousSlug: string | null
  /** Whether the current user owns the property. Only the creator
   *  sees Edit/Delete + the marketplace toggle inside the share
   *  dialog. Share (read-only access to the unbranded link) is open
   *  to everyone — including shared-with recipients. */
  canManage?:           boolean
  /** Slug of the viewing agent. Passed to the share dialog so the
   *  copied branded URL includes `?via=<slug>` and leads route to
   *  this agent instead of the platform's super_admin. */
  viewerAgentSlug?:     string | null
}

/**
 * 3-dot menu rendered as a top-right overlay on PropertyCard.
 * Houses Share (opens the share dialog), Edit (link), and Delete
 * (with confirmation dialog) so the agent has a single, consistent
 * actions surface per card.
 *
 * Share + Delete dialogs use controlled `open` state so they can be
 * triggered from inside the dropdown without nesting issues.
 */
export function PropertyCardActions({
  propertyId, propertyTitle, propertySlug,
  isMarketplaceVisible, initialAnonymousSlug,
  canManage = true,
  viewerAgentSlug = null,
}: Props) {
  const router = useRouter()
  const t = useTranslations("card")

  const [shareOpen,   setShareOpen]   = useState(false)
  const [confirming,  setConfirming]  = useState(false)
  const [pending, startTransition]    = useTransition()
  // Independent loading flags for the two new marketing actions so
  // we can show a per-action toast / disabled state.
  const [downloading, setDownloading] = useState(false)
  const [copying,     setCopying]     = useState(false)

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteProperty(propertyId)
      if (!res.success) {
        toast.error(res.error || t("deleteError"))
        return
      }
      toast.success(t("deletedToast"))
      setConfirming(false)
      router.refresh()
    })
  }

  /** Download all photos (property + inherited project) as a ZIP.
   *  We trigger a real navigation via a hidden <a download> click
   *  so the browser's normal download UX kicks in (progress, etc.). */
  async function handleDownloadPhotos() {
    if (downloading) return
    setDownloading(true)
    const dismiss = toast.loading(t("downloadingPhotos"))
    try {
      // Fetch first to surface 404 / 502 cleanly as a toast instead of
      // a half-broken ".zip" file. For 5-30 typical real-estate photos
      // this is fast enough that the UX feels instant.
      const res = await fetch(`/api/properties/${propertyId}/photos.zip`, {
        cache: "no-store",
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob  = await res.blob()
      const url   = URL.createObjectURL(blob)
      const a     = document.createElement("a")
      const fname = res.headers.get("Content-Disposition")?.match(/filename="?([^"]+)"?/)?.[1]
                  ?? `${propertySlug || propertyId}-fotos.zip`
      a.href     = url
      a.download = fname
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(t("downloadPhotosOk"), { id: dismiss })
    } catch {
      toast.error(t("downloadPhotosErr"), { id: dismiss })
    } finally {
      setDownloading(false)
    }
  }

  /** Generate the social-post text and copy it to the clipboard
   *  using the current user's contact info. */
  async function handleCopySocialPost() {
    if (copying) return
    setCopying(true)
    const dismiss = toast.loading(t("copyingSocialPost"))
    try {
      const result = await getSocialPostContent(propertyId)
      if (!result.success) throw new Error(result.error)
      await navigator.clipboard.writeText(result.data.text)
      toast.success(t("copySocialPostOk"), { id: dismiss })
    } catch {
      toast.error(t("copySocialPostErr"), { id: dismiss })
    } finally {
      setCopying(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={t("menuLabel")}
              className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-white/95 backdrop-blur shadow-sm border hover:bg-white transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <EllipsisVerticalIcon className="h-3.5 w-3.5" />
            </button>
          }
        />
        <DropdownMenuContent
          align="end"
          className="w-56"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Marketing actions — available to anyone who can SEE the
              listing (owner, admin, or shared-with). They don't change
              the listing, just help the agent market it under their
              own contact info. */}
          <DropdownMenuItem onClick={handleDownloadPhotos} disabled={downloading}>
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            {t("downloadPhotos")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopySocialPost} disabled={copying}>
            <ClipboardDocumentIcon className="h-4 w-4 mr-2" />
            {t("copySocialPost")}
          </DropdownMenuItem>

          {/* Share is available to everyone — owner publishes /
              shares with agents from inside the dialog; recipients
              copy the always-on unbranded link to forward. */}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShareOpen(true)}>
            <ShareIcon className="h-4 w-4 mr-2" />
            {t("shareCta")}
          </DropdownMenuItem>

          {/* Edit + Delete — creator only. */}
          {canManage && (
            <>
              <DropdownMenuItem render={<Link href={`/properties/${propertyId}`} />}>
                <PencilSquareIcon className="h-4 w-4 mr-2" />
                {t("edit")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setConfirming(true)}
                className="text-destructive focus:text-destructive"
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                {t("delete")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Share dialog — always mounted. canManage drives whether the
          marketplace toggle + collaborators panel render inside.
          The viewing agent's slug is always passed so "Mi link"
          carries `?via=<slug>` and leads route to the viewer
          (owner or recipient). */}
      <SharePropertyDialog
        propertyId={propertyId}
        propertyTitle={propertyTitle}
        propertySlug={propertySlug}
        isMarketplaceVisible={isMarketplaceVisible}
        initialAnonymousSlug={initialAnonymousSlug}
        canManage={canManage}
        viaAgentSlug={viewerAgentSlug}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />

      {/* Delete confirmation — owner-only. */}
      {canManage && (
        <Dialog open={confirming} onOpenChange={setConfirming}>
          <DialogContent onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
              <DialogDescription>
                {t("deleteConfirmBody")}
                <br />
                <span className="block mt-2 text-xs text-foreground font-medium truncate">
                  {propertyTitle}
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
                {t("deleteCancel")}
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={pending}>
                {pending ? "…" : t("deleteConfirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
