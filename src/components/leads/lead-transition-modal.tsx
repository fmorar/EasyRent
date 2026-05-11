"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { LeadChipSelect } from "@/components/property/lead-chip-select"
import type { StageTransitionMeta } from "@/lib/actions/lead.actions"

export type TransitionMode = "contacted" | "visit_scheduled" | "lost"

interface Props {
  mode:     TransitionMode | null
  open:     boolean
  /** Called when the agent confirms with the metadata they entered.
   *  Returning a Promise lets the parent show a "saving" state. */
  onConfirm: (meta: StageTransitionMeta) => Promise<void>
  /** Called when the agent cancels — parent should revert any
   *  optimistic UI it applied. */
  onCancel: () => void
}

/**
 * Single dialog used for every "this transition needs a bit of context"
 * moment in the lead kanban. Renders different fields based on `mode`:
 *
 *   contacted        → chip select for channel + free notes
 *   visit_scheduled  → datetime picker (REQUIRED) + notes
 *   lost             → chip select for reason (REQUIRED) + notes
 *
 * Required fields keep the Save button disabled until satisfied so we
 * never get a "this lead was lost but we don't know why" row in the DB.
 */
export function LeadTransitionModal({ mode, open, onConfirm, onCancel }: Props) {
  const t = useTranslations("leads.transition")

  // Keep state local to the modal — gets reset every open via key.
  const [channel, setChannel]
    = useState<NonNullable<StageTransitionMeta["contact_channel"]> | null>(null)
  const [appointmentAt, setAppointmentAt] = useState<string>("")
  const [reason, setReason]
    = useState<NonNullable<StageTransitionMeta["lost_reason"]> | null>(null)
  const [notes, setNotes] = useState<string>("")
  const [saving, setSaving] = useState(false)

  function reset() {
    setChannel(null); setAppointmentAt(""); setReason(null); setNotes("")
    setSaving(false)
  }

  function handleClose() {
    if (saving) return
    reset()
    onCancel()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!mode) return
    setSaving(true)

    const meta: StageTransitionMeta = {}
    if (mode === "contacted") {
      meta.contact_channel = channel ?? undefined
      meta.contact_notes   = notes || undefined
    } else if (mode === "visit_scheduled") {
      meta.appointment_at    = appointmentAt
        ? new Date(appointmentAt).toISOString()
        : undefined
      meta.appointment_notes = notes || undefined
    } else if (mode === "lost") {
      meta.lost_reason = reason ?? undefined
      meta.lost_notes  = notes || undefined
    }

    try {
      await onConfirm(meta)
      reset()
    } finally {
      setSaving(false)
    }
  }

  // ── Per-mode validation ────────────────────────────────────
  let canSave = false
  if (mode === "contacted")       canSave = !!channel
  if (mode === "visit_scheduled") canSave = !!appointmentAt
  if (mode === "lost")            canSave = !!reason

  // Pre-compute the chip options up front so the JSX stays readable.
  const channelOptions = (
    ["whatsapp", "phone", "email", "in_person", "other"] as const
  ).map((v) => ({ value: v, label: t(`channel.${v}`) }))

  const lostOptions = (
    [
      "price_too_high", "location_not_fit", "pets_not_allowed",
      "insufficient_parking", "move_in_date_mismatch", "budget_too_low",
      "rented_or_bought_elsewhere", "unresponsive", "not_qualified", "other",
    ] as const
  ).map((v) => ({ value: v, label: t(`lostReason.${v}`) }))

  // Note: we don't pre-fill the datetime input. React Compiler's
  // purity rules forbid `Date.now()` during render and a setState-in-
  // effect approach is also forbidden. The native `<input type=
  // "datetime-local">` shows a clean placeholder; `required` blocks
  // submit if the agent skips it.

  if (!mode) return null

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="space-y-1">
            <DialogTitle>
              {mode === "contacted"       && t("contactedTitle")}
              {mode === "visit_scheduled" && t("appointmentTitle")}
              {mode === "lost"            && t("lostTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {mode === "contacted"       && t("contactedDesc")}
              {mode === "visit_scheduled" && t("appointmentDesc")}
              {mode === "lost"            && t("lostDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {mode === "contacted" && (
              <LeadChipSelect
                options={channelOptions}
                value={channel}
                onChange={setChannel}
                clearable={false}
              />
            )}

            {mode === "visit_scheduled" && (
              <div className="space-y-1.5">
                <label htmlFor="appointment-at" className="text-xs font-medium text-muted-foreground">
                  {t("appointmentLabel")} *
                </label>
                <Input
                  id="appointment-at"
                  type="datetime-local"
                  value={appointmentAt}
                  onChange={(e) => setAppointmentAt(e.target.value)}
                  required
                />
              </div>
            )}

            {mode === "lost" && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("reasonLabel")} *
                </p>
                <LeadChipSelect
                  options={lostOptions}
                  value={reason}
                  onChange={setReason}
                  clearable={false}
                />
              </div>
            )}

            <Textarea
              placeholder={t("notesPlaceholder")}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none text-sm"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={saving}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={!canSave || saving}>
              {saving ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
