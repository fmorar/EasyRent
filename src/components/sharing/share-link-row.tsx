"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CheckIcon, ClipboardIcon } from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils"

interface Props {
  /** Icon shown in the leading slot. */
  icon:        React.ReactNode
  /** Bold title (e.g. "Link público", "Link sin marca"). */
  title:       string
  /** Secondary line explaining what this link does. */
  description: React.ReactNode
  /** The URL to display + copy. Pass `null` when disabled. */
  url:         string | null
  /** Optional pill rendered next to the title. */
  badge?:      React.ReactNode
  /** Optional toggle switch on the right (e.g. enable/disable anonymous link). */
  control?:    React.ReactNode
  /** Tone for the icon container. */
  tone?:       "primary" | "muted" | "success"
  className?:  string
  /** Callback invoked AFTER a successful copy. Used by SharePropertyDialog
   *  to fire the analytics `share_clicked` event with the right context. */
  onCopy?:     () => void
}

const TONE_STYLES: Record<NonNullable<Props["tone"]>, string> = {
  primary: "bg-primary/15 text-foreground",
  success: "bg-success-soft text-success",
  muted:   "bg-muted text-muted-foreground",
}

/**
 * Canonical "share link" row for the share dialog.
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ [icon]  Title    [badge]                       [toggle] │
 *   │         Description text…                                │
 *   │                                                          │
 *   │   ┌────────────────────────────────────┐  ┌──────────┐  │
 *   │   │ https://app.example.com/p/...      │  │  Copiar  │  │
 *   │   └────────────────────────────────────┘  └──────────┘  │
 *   └─────────────────────────────────────────────────────────┘
 */
export function ShareLinkRow({
  icon,
  title,
  description,
  url,
  badge,
  control,
  tone = "primary",
  className,
  onCopy,
}: Props) {
  const t = useTranslations("shareDialog")
  const [copied, setCopied] = useState(false)

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success(t("linkCopied"))
      onCopy?.()
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error(t("linkCopyError"))
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header row */}
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 [&>svg]:h-4 [&>svg]:w-4",
            TONE_STYLES[tone],
          )}
        >
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground">{title}</p>
            {badge}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {description}
          </p>
        </div>
        {control && <div className="shrink-0">{control}</div>}
      </div>

      {/* URL + Copy row */}
      {url && (
        <div className="flex items-center gap-2 pl-12">
          <code className="flex-1 min-w-0 text-xs font-mono truncate rounded-md border bg-muted/30 px-3 py-2">
            {url}
          </code>
          <Button
            type="button"
            size="sm"
            variant={copied ? "secondary" : "outline"}
            onClick={copy}
            className="shrink-0"
          >
            {copied ? (
              <>
                <CheckIcon className="h-3.5 w-3.5 mr-1.5" />
                {t("copied")}
              </>
            ) : (
              <>
                <ClipboardIcon className="h-3.5 w-3.5 mr-1.5" />
                {t("copy")}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
