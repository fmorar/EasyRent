"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { ChevronLeftIcon, ChevronRightIcon, CheckCircleIcon } from "@heroicons/react/24/outline"
import { capturePublicLead } from "@/lib/actions/lead.actions"

interface Props {
  /** Decorative photos for the left panel. */
  photos: string[]
}

/**
 * "Still haven't found what you're looking for?" CTA section.
 * Two columns: image carousel on the left, dark lead-capture form on the right.
 */
export function MarketplaceCta({ photos }: Props) {
  const t = useTranslations("marketplace.cta")
  const INTENT_OPTIONS = [
    { value: "buy_property",   label: t("intentBuy")        },
    { value: "rent_property",  label: t("intentRent")       },
    { value: "schedule_visit", label: t("intentVisit")      },
    { value: "investment",     label: t("intentInvestment") },
    { value: "other",          label: t("intentOther")      },
  ]
  const [photoIdx, setPhotoIdx] = useState(0)
  const [first,    setFirst]    = useState("")
  const [last,     setLast]     = useState("")
  const [intent,   setIntent]   = useState<string>("buy_property")
  const [notes,    setNotes]    = useState("")
  const [done,     setDone]     = useState(false)
  const [isPending, startTransition] = useTransition()

  const hasPhotos = photos.length > 0
  const cur       = photos[photoIdx]

  function next() { setPhotoIdx((i) => (i + 1) % photos.length) }
  function prev() { setPhotoIdx((i) => (i - 1 + photos.length) % photos.length) }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!first.trim() && !last.trim()) {
      toast.error(t("nameRequired"))
      return
    }
    const fullName = [first.trim(), last.trim()].filter(Boolean).join(" ")
    const intentLabel = INTENT_OPTIONS.find((o) => o.value === intent)?.label ?? intent
    startTransition(async () => {
      const result = await capturePublicLead({
        full_name:      fullName,
        message:        `Intención: ${intentLabel}${notes ? `\n\n${notes}` : ""}`,
        source:         "marketplace",
        source_context: "Marketplace CTA",
      })
      if (!result.success) {
        toast.error(result.error ?? t("errorToast"))
        return
      }
      toast.success(t("successToast"))
      setDone(true)
    })
  }

  return (
    <section className="grid lg:grid-cols-12 min-h-[480px] rounded-2xl overflow-hidden mx-4 sm:mx-6 lg:mx-8">
      {/* Left: image carousel — narrower than form so the dark form leads */}
      <div className="relative bg-muted h-56 sm:h-72 lg:h-auto lg:col-span-5">
        {hasPhotos && cur ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cur}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-hero-fallback" />
        )}

        {photos.length > 1 && (
          <div className="absolute bottom-5 right-5 flex gap-2">
            <button
              type="button"
              onClick={prev}
              aria-label={t("prevPhoto")}
              className="h-9 w-9 rounded-full border-2 border-white/80 text-white flex items-center justify-center hover:bg-white/20 transition-colors backdrop-blur-sm"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label={t("nextPhoto")}
              className="h-9 w-9 rounded-full border-2 border-white/80 text-white flex items-center justify-center hover:bg-white/20 transition-colors backdrop-blur-sm"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Right: dark form — gets the wider column for breathing room around the headline */}
      <div className="bg-foreground text-background p-(--spacing-block) sm:p-(--spacing-section) lg:p-(--spacing-major) flex flex-col justify-center lg:col-span-7">
        {done ? (
          <div className="space-y-4 text-center">
            <CheckCircleIcon className="h-12 w-12 mx-auto text-background/80" />
            <h2 className="text-2xl font-heading font-bold tracking-tight">{t("doneHeadline")}</h2>
            <p className="text-background/70">{t("doneBody")}</p>
          </div>
        ) : (
          <>
            <h2 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight leading-tight">
              {t("headline")}
            </h2>
            <form onSubmit={submit} className="mt-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Field label={t("nameLabel")}>
                  <input
                    value={first}
                    onChange={(e) => setFirst(e.target.value)}
                    placeholder={t("namePlaceholder")}
                    disabled={isPending}
                    className="w-full bg-transparent border-b border-background/30 py-2 text-sm placeholder:text-background/40 focus:outline-none focus:border-background"
                  />
                </Field>
                <Field label={t("lastLabel")}>
                  <input
                    value={last}
                    onChange={(e) => setLast(e.target.value)}
                    placeholder={t("lastPlaceholder")}
                    disabled={isPending}
                    className="w-full bg-transparent border-b border-background/30 py-2 text-sm placeholder:text-background/40 focus:outline-none focus:border-background"
                  />
                </Field>
              </div>

              <Field label={t("intentLabel")}>
                <select
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  disabled={isPending}
                  className="w-full bg-transparent border-b border-background/30 py-2 text-sm focus:outline-none focus:border-background"
                >
                  {INTENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} className="bg-foreground text-background">
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t("notesLabel")}>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("notesPlaceholder")}
                  rows={3}
                  disabled={isPending}
                  className="w-full bg-background/5 border border-background/15 rounded-lg p-3 text-sm placeholder:text-background/40 focus:outline-none focus:ring-2 focus:ring-background/20 resize-none"
                />
              </Field>

              <button
                type="submit"
                disabled={isPending}
                className="px-8 py-3 rounded-full bg-background text-foreground text-sm font-medium hover:bg-background/90 disabled:opacity-50 transition-colors"
              >
                {isPending ? t("sending") : t("send")}
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-white/60 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  )
}
