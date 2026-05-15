"use client"

import { useState, useTransition } from "react"
import { useLocale, useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import { ArrowUpRightIcon, CheckCircleIcon } from "@heroicons/react/24/outline"
import { subscribeToNewsletter } from "@/lib/actions/newsletter.actions"

/**
 * Footer newsletter capture. Single email field + ink CTA pill.
 * Captures via `capturePublicLead` with `source = "newsletter"` so it
 * lands in the same lead table the rest of the funnels use; an admin
 * can filter by source to see newsletter intents specifically.
 */
export function NewsletterForm() {
  const t        = useTranslations("newsletter")
  const locale   = useLocale()
  const pathname = usePathname()

  const [email,  setEmail]  = useState("")
  const [done,   setDone]   = useState(false)
  const [error,  setError]  = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmed = email.trim()
    if (!trimmed) {
      setError(t("errorMissingEmail"))
      return
    }
    // Quick shape check — server validates again.
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setError(t("errorInvalidEmail"))
      return
    }
    startTransition(async () => {
      const result = await subscribeToNewsletter({
        email:          trimmed,
        // Strip the locale prefix from the path so the source reads
        // as the actual surface ("/" / "/agents/sofia") rather than
        // "/es/" / "/es/agents/sofia".
        source_context: `Footer · ${pathname.replace(/^\/(?:es|en)(?=\/|$)/, "") || "/"}`,
        locale,
      })
      if (!result.success) {
        toast.error(result.error ?? t("errorGeneric"))
        return
      }
      toast.success(t("successToast"))
      setDone(true)
    })
  }

  if (done) {
    return (
      <div className="inline-flex items-center gap-2 h-11 px-4 rounded-full bg-success-soft text-success text-sm font-medium">
        <CheckCircleIcon className="h-4 w-4" />
        {t("successPill")}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-(--spacing-tight)" noValidate>
      <div className="flex items-stretch gap-1.5 rounded-full border border-border bg-background p-1.5 max-w-md">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          disabled={isPending}
          aria-invalid={error ? "true" : undefined}
          className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground px-3 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors duration-(--duration-state) ease-(--ease-out-quart) disabled:opacity-50 shrink-0"
        >
          {isPending ? t("sendingState") : t("subscribeCta")}
          {!isPending && <ArrowUpRightIcon className="h-3.5 w-3.5" />}
        </button>
      </div>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      <p className="text-[11px] text-muted-foreground leading-relaxed max-w-md">
        {t("privacyNote")}
      </p>
    </form>
  )
}
