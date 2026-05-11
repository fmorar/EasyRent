"use client"

import { useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { capturePublicLead } from "@/lib/actions/lead.actions"
import { LegalDisclaimer } from "@/components/shared/legal-disclaimer"
import { trackEvent } from "@/lib/analytics/track"
import { LeadChipSelect } from "@/components/property/lead-chip-select"
import type {
  LeadInquiryType, LeadMoveInWindow, LeadPetsStatus, LeadBudgetRange,
} from "@/types"

interface TourFormProps {
  propertyId:   string
  propertyName: string
  propertySlug: string
  capturedBy?:  string | null
  /** When the listing is a rental, we surface pets + party_size chips
   *  (very useful signals for filtering). For sales we hide them
   *  because they're noise. */
  listingType?: "sale" | "rent" | null
}

export function TourForm({
  propertyId, propertyName, propertySlug, capturedBy,
  listingType,
}: TourFormProps) {
  // `propertyName` is intentionally unused at runtime; reserved for future
  // tracking metadata. Kept in the props to avoid breaking call sites.
  void propertyName
  const t = useTranslations("properties")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  // Enrichment chip state
  const [inquiry,    setInquiry]    = useState<LeadInquiryType  | null>(null)
  const [moveIn,     setMoveIn]     = useState<LeadMoveInWindow | null>(null)
  const [pets,       setPets]       = useState<LeadPetsStatus   | null>(null)
  const [partySize,  setPartySize]  = useState<number           | null>(null)
  const [budget,     setBudget]     = useState<LeadBudgetRange  | null>(null)
  const [showMore,   setShowMore]   = useState(false)

  const isRental = listingType === "rent"

  // Fire `contact_form_started` once on first interaction
  const startFiredRef = useRef(false)
  function fireStartedOnce() {
    if (startFiredRef.current) return
    startFiredRef.current = true
    trackEvent({
      property_id: propertyId,
      event_type:  "contact_form_started",
      source:      "tour_form",
    })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus("loading")

    const fd = new FormData(e.currentTarget)
    const result = await capturePublicLead({
      full_name:      (fd.get("full_name") as string).trim(),
      email:          (fd.get("email") as string).trim() || undefined,
      phone:          (fd.get("phone") as string).trim() || undefined,
      message:        (fd.get("message") as string).trim() || undefined,
      source:         "marketplace",
      source_context: propertySlug,
      property_id:    propertyId,
      captured_by:    capturedBy ?? undefined,
      enrichment: {
        inquiry_type:   inquiry  ?? undefined,
        move_in_window: moveIn   ?? undefined,
        has_pets:       pets     ?? undefined,
        party_size:     partySize ?? undefined,
        budget_range:   budget   ?? undefined,
      },
    })

    if (result.success) {
      trackEvent({
        property_id: propertyId,
        event_type:  "contact_form_submitted",
        source:      "tour_form",
        metadata:    {
          lead_id:        result.data.id,
          inquiry_type:   inquiry,
          move_in_window: moveIn,
          has_budget:     budget != null,
        },
      })
      setStatus("success")
    } else {
      setStatus("error")
      setErrorMsg(result.error ?? t("errorDefault"))
    }
  }

  if (status === "success") {
    return (
      <div className="text-center py-(--spacing-block) space-y-1">
        <p className="font-semibold text-sm">{t("requestSent")}</p>
        <p className="text-xs text-muted-foreground">
          {t("requestSentDesc")}
        </p>
      </div>
    )
  }

  // Translated chip option lists. Memoization isn't worth it here —
  // these arrays are built each render but are short and pure.
  const inquiryOptions: Array<{ value: LeadInquiryType; label: string }> = [
    { value: "availability", label: t("inquiry.availability") },
    { value: "visit",        label: t("inquiry.visit") },
    { value: "info",         label: t("inquiry.info") },
  ]
  const moveInOptions: Array<{ value: LeadMoveInWindow; label: string }> = [
    { value: "immediate",           label: t("moveIn.immediate") },
    { value: "one_month",           label: t("moveIn.one_month") },
    { value: "one_to_three_months", label: t("moveIn.one_to_three_months") },
    { value: "three_to_six_months", label: t("moveIn.three_to_six_months") },
    { value: "browsing",            label: t("moveIn.browsing") },
  ]
  const petsOptions: Array<{ value: LeadPetsStatus; label: string }> = [
    { value: "none",      label: t("pets.none") },
    { value: "small_dog", label: t("pets.small_dog") },
    { value: "large_dog", label: t("pets.large_dog") },
    { value: "cat",       label: t("pets.cat") },
    { value: "multiple",  label: t("pets.multiple") },
  ]
  const partySizeOptions: Array<{ value: number; label: string }> = [
    { value: 1, label: t("partySize.one") },
    { value: 2, label: t("partySize.two") },
    { value: 3, label: t("partySize.three") },
    { value: 4, label: t("partySize.four") },
    { value: 5, label: t("partySize.fivePlus") },
  ]
  const budgetOptions: Array<{ value: LeadBudgetRange; label: string }> = [
    { value: "under_1000",        label: t("budget.under_1000") },
    { value: "between_1000_1500", label: t("budget.between_1000_1500") },
    { value: "between_1500_2000", label: t("budget.between_1500_2000") },
    { value: "between_2000_3000", label: t("budget.between_2000_3000") },
    { value: "above_3000",        label: t("budget.above_3000") },
  ]

  return (
    <form onSubmit={handleSubmit} onFocus={fireStartedOnce} className="space-y-3">

      {/* Core PII fields */}
      <Input name="full_name" placeholder={t("fullNamePlaceholder")} required
             className="text-sm h-9" disabled={status === "loading"} />
      <Input name="email"     type="email" placeholder={t("emailPlaceholder")}
             className="text-sm h-9" disabled={status === "loading"} />
      <Input name="phone"     type="tel"   placeholder={t("phonePlaceholder")}
             className="text-sm h-9" disabled={status === "loading"} />
      <Textarea name="message" placeholder={t("messagePlaceholder")} rows={2}
                className="text-sm resize-none" disabled={status === "loading"} />

      {/* Always-visible enrichments — high signal, low friction */}
      <LeadChipSelect<LeadInquiryType>
        label={t("inquiry.label")}
        options={inquiryOptions}
        value={inquiry}
        onChange={setInquiry}
      />

      <LeadChipSelect<LeadMoveInWindow>
        label={t("moveIn.label")}
        options={moveInOptions}
        value={moveIn}
        onChange={setMoveIn}
      />

      {/* Rental-only enrichments */}
      {isRental && (
        <>
          <LeadChipSelect<LeadPetsStatus>
            label={t("pets.label")}
            options={petsOptions}
            value={pets}
            onChange={setPets}
          />

          <LeadChipSelect<number>
            label={t("partySize.label")}
            options={partySizeOptions}
            value={partySize}
            onChange={setPartySize}
          />
        </>
      )}

      {/* Progressive disclosure: budget is medium-friction so we hide it */}
      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className="text-[11px] text-muted-foreground underline-offset-4 hover:underline"
      >
        {t("moreDetailsToggle")}
      </button>
      {showMore && (
        <LeadChipSelect<LeadBudgetRange>
          label={t("budget.label")}
          options={budgetOptions}
          value={budget}
          onChange={setBudget}
        />
      )}

      {status === "error" && (
        <p className="text-xs text-destructive">{errorMsg}</p>
      )}

      <Button type="submit" className="w-full" disabled={status === "loading"}>
        {status === "loading" ? t("sending") : t("scheduleButton")}
      </Button>

      <LegalDisclaimer variant="privacy" />
    </form>
  )
}
