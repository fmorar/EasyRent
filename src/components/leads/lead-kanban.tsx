"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { PIPELINE_STAGES, LEAD_STAGE_LABELS, timeAgo } from "@/lib/utils"
import { updateLeadStage, type StageTransitionMeta } from "@/lib/actions/lead.actions"
import {
  LeadTransitionModal, type TransitionMode,
} from "@/components/leads/lead-transition-modal"
import type { Lead } from "@/types"

interface LeadKanbanProps {
  leadsByStage:  Record<string, Lead[]>
  currentUserId: string
  /** Map of lead id → WhatsApp conversation id. When a lead has an
   *  active concierge thread, the card surfaces a chat icon that
   *  deep-links to /conversations/<id>. Empty map is fine — leads
   *  without a thread render exactly as before. */
  conversationsByLeadId?: Record<string, string>
}

// Lane backgrounds — semantic-soft tints. Funnel rises from neutral
// → info → primary brand wash at the visit stage → warning → success
// at close. Lost is destructive. All routed through tokens so the
// dark-mode variants stay coherent.
const STAGE_COLORS: Record<string, string> = {
  new:                "bg-muted",
  contacted:          "bg-info-soft",
  interested:         "bg-info-soft",
  visit_scheduled:    "bg-primary/10",
  negotiating:        "bg-warning-soft",
  contract_requested: "bg-warning-soft",
  closed:             "bg-success-soft",
  lost:               "bg-destructive-soft",
}

// Stages whose transition deserves a quick "give me a bit of context" modal.
// Anything not in this map is a silent stage change.
const TRANSITION_MODE_BY_STAGE: Record<string, TransitionMode> = {
  contacted:       "contacted",
  visit_scheduled: "visit_scheduled",
  lost:            "lost",
}

export function LeadKanban({ leadsByStage, currentUserId, conversationsByLeadId = {} }: LeadKanbanProps) {
  // `currentUserId` is unused for now — the kanban inherits filtering
  // from the page-level RLS query. Keep the prop to avoid breaking
  // call sites and to support future "highlight my leads" UI.
  void currentUserId
  const t = useTranslations("leads.transition")
  const [localLeads, setLocalLeads] = useState<Record<string, Lead[]>>(leadsByStage)
  const [hoveredStage, setHoveredStage] = useState<string | null>(null)

  // Pending transition state — populated when the user drops into a stage
  // that needs metadata. The modal opens; on confirm we apply the
  // optimistic update + persist; on cancel we drop the transition.
  const [pending, setPending] = useState<{
    leadId:    string
    fromStage: string
    toStage:   string
    mode:      TransitionMode
  } | null>(null)

  // Apply the optimistic + server-side update for a transition.
  async function applyTransition(
    leadId: string, fromStage: string, toStage: string,
    meta: StageTransitionMeta = {},
  ) {
    const lead = localLeads[fromStage]?.find((l) => l.id === leadId)
    if (!lead) return

    setLocalLeads((prev) => ({
      ...prev,
      [fromStage]: prev[fromStage].filter((l) => l.id !== leadId),
      [toStage]:   [{ ...lead, stage: toStage as Lead["stage"] }, ...(prev[toStage] ?? [])],
    }))

    const result = await updateLeadStage(leadId, toStage as Lead["stage"], meta)
    if (!result.success) {
      // Revert
      setLocalLeads(leadsByStage)
      toast.error(result.error || t("saveError"))
    }
  }

  async function handleStageDrop(leadId: string, fromStage: string, toStage: string) {
    if (fromStage === toStage) return

    const mode = TRANSITION_MODE_BY_STAGE[toStage]
    if (mode) {
      // Defer: open the modal first, apply on submit.
      setPending({ leadId, fromStage, toStage, mode })
      return
    }

    await applyTransition(leadId, fromStage, toStage)
  }

  async function handleModalConfirm(meta: StageTransitionMeta) {
    if (!pending) return
    await applyTransition(pending.leadId, pending.fromStage, pending.toStage, meta)
    setPending(null)
  }

  return (
    <>
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-4 pb-4 min-w-max">
          {PIPELINE_STAGES.map((stage) => {
            const leads = localLeads[stage] ?? []
            return (
              <div
                key={stage}
                className="w-64 flex-shrink-0"
                onDragOver={(e) => {
                  e.preventDefault()
                  if (hoveredStage !== stage) setHoveredStage(stage)
                }}
                onDragLeave={(e) => {
                  // Only clear when leaving the column boundary, not its children.
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setHoveredStage((s) => (s === stage ? null : s))
                  }
                }}
                onDrop={(e) => {
                  const data = e.dataTransfer.getData("text/plain")
                  const { leadId, fromStage } = JSON.parse(data)
                  setHoveredStage(null)
                  handleStageDrop(leadId, fromStage, stage)
                }}
              >
                {/* Column header */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {LEAD_STAGE_LABELS[stage]}
                  </span>
                  <Badge variant="secondary" className="text-xs h-5 min-w-5 flex items-center justify-center">
                    {leads.length}
                  </Badge>
                </div>

                {/* Cards */}
                <div
                  className={`rounded-lg p-2 min-h-32 space-y-2 transition-colors duration-150 ease-out ${STAGE_COLORS[stage]} ${
                    hoveredStage === stage ? "ring-2 ring-primary/30 bg-primary/5" : ""
                  }`}
                >
                  {leads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      stage={stage}
                      conversationId={conversationsByLeadId[lead.id]}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Transition modal — shared across contacted / visit_scheduled / lost */}
      <LeadTransitionModal
        open={pending !== null}
        mode={pending?.mode ?? null}
        onConfirm={handleModalConfirm}
        onCancel={() => setPending(null)}
      />
    </>
  )
}

function LeadCard({
  lead, stage, conversationId,
}: {
  lead:            Lead
  stage:           string
  conversationId?: string
}) {
  return (
    <Card
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          "text/plain",
          JSON.stringify({ leadId: lead.id, fromStage: stage })
        )
      }}
      className="cursor-grab active:cursor-grabbing shadow-none border hover:shadow-sm transition-shadow"
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium line-clamp-1 flex-1">{lead.full_name}</p>
          {/* WhatsApp deep-link — only when the lead has an active concierge thread.
              Click bubbles up to the card by default, which would start the drag;
              stop propagation so the link wins. */}
          {conversationId && (
            <a
              href={`/conversations/${conversationId}`}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-primary transition-colors shrink-0"
              title="Ver conversación de WhatsApp"
              aria-label="Ver conversación de WhatsApp"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </a>
          )}
        </div>

        {(lead.email || lead.phone) && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {lead.email ?? lead.phone}
          </p>
        )}

        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs capitalize">
            {lead.source.replace("_", " ")}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {timeAgo(lead.created_at)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
