"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { CheckIcon, LinkIcon } from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils"

interface Props {
  /** Path on the current origin to share (e.g. `/p/my-house`). */
  path:        string
  /** Reserved for callers that used to feed it to the native share
   *  sheet. We no longer call `navigator.share` (the public surfaces
   *  only need "give me the link"), but we keep the prop so the
   *  existing call sites compile without changes. */
  title?:      string
  /** Optional className override for the button. */
  className?:  string
}

/**
 * Public-facing "copy link" button. One job: write the absolute URL
 * for `path` to the clipboard and confirm with a check + toast.
 *
 * We previously routed through `navigator.share` first, but that
 * surfaces the OS share sheet — extra modal, extra step, and on
 * desktop it just falls back to clipboard anyway. The public pages
 * only need "send me this link", so we always copy directly.
 */
export function PublicShareButton({ path, className }: Props) {
  const t = useTranslations("shareDialog")
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (typeof window === "undefined") return
    const url = `${window.location.origin}${path}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success(t("linkCopied"))
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error(t("linkCopyError"))
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={t("copyLinkCta")}
      className={cn(
        "inline-flex items-center gap-1.5 h-9 px-3 rounded-md border bg-background hover:bg-muted text-sm font-medium transition-colors",
        className,
      )}
    >
      {copied ? (
        <>
          <CheckIcon className="h-3.5 w-3.5" />
          {t("copied")}
        </>
      ) : (
        <>
          <LinkIcon className="h-3.5 w-3.5" />
          {t("copyLinkCta")}
        </>
      )}
    </button>
  )
}
