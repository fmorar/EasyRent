"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { SharePropertyDialog } from "@/components/sharing/share-property-dialog"

interface Props {
  propertyId:           string
  propertyTitle:        string
  propertySlug:         string
  isMarketplaceVisible: boolean
  initialAnonymousSlug?: string | null
}

/**
 * Reads `?share=1` on mount and auto-opens the share dialog.
 * Used after creating a new property to immediately offer sharing.
 */
export function AutoSharePrompt({
  propertyId,
  propertyTitle,
  propertySlug,
  isMarketplaceVisible,
  initialAnonymousSlug,
}: Props) {
  const params   = useSearchParams()
  const router   = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (params.get("share") === "1") {
      setOpen(true)
    }
  }, [params])

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next && params.get("share") === "1") {
      // Strip the param so a refresh doesn't re-open
      const cleaned = new URLSearchParams(params.toString())
      cleaned.delete("share")
      router.replace(`${pathname}${cleaned.size > 0 ? `?${cleaned.toString()}` : ""}`)
    }
  }

  return (
    <SharePropertyDialog
      propertyId={propertyId}
      propertyTitle={propertyTitle}
      propertySlug={propertySlug}
      isMarketplaceVisible={isMarketplaceVisible}
      initialAnonymousSlug={initialAnonymousSlug}
      open={open}
      onOpenChange={handleOpenChange}
    >
      {/* Hidden trigger — this dialog is opened programmatically only.
          Must be a <button> so Base UI's DialogTrigger keeps native button semantics. */}
      <button type="button" className="hidden" aria-hidden tabIndex={-1} />
    </SharePropertyDialog>
  )
}
