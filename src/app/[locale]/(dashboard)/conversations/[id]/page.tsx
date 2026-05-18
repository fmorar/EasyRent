import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon, PhoneIcon } from "@heroicons/react/24/outline"
import { requireAuth } from "@/lib/auth"
import { getConversationDetailForUser } from "@/lib/conversations.queries"
import { formatPhoneDisplay } from "@/lib/phone"
import { ConversationThread } from "@/components/conversations/conversation-thread"
import { ConversationStatusBadge } from "@/components/conversations/conversation-status-badge"
import { ConversationHandoffToggle } from "@/components/conversations/conversation-handoff-toggle"
import { LeadProfileCard } from "@/components/conversations/lead-profile-card"
import { LeadProfileSheet } from "@/components/conversations/lead-profile-sheet"
import { ChatCompose } from "@/components/conversations/chat-compose"
import { ScrollIntoViewOnMount } from "@/components/conversations/scroll-into-view-on-mount"

interface PageProps {
  params: Promise<{ id: string }>
}

/** WhatsApp Business customer-service window length. Free-form
 *  messages outside this window get rejected by Twilio (code 63016).
 *  Both this constant and `sendManualReply` enforce it; the compose
 *  box uses it to render its disabled state with the exact same
 *  threshold the server check applies. */
const WA_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Right-pane content for a single conversation thread.
 *
 * Layout: top bar (status, handoff toggle, profile-sheet trigger) →
 * scrollable thread → bottom compose box. The list pane is rendered
 * by the layout above, so this page only owns the right column.
 */
export default async function ConversationDetailPage({ params }: PageProps) {
  const { profile } = await requireAuth()
  const { id }      = await params
  const detail      = await getConversationDetailForUser({ profile, conversationId: id })
  if (!detail) notFound()

  const { conversation, lead, messages, mentionedProperty } = detail
  const displayName = lead.full_name && lead.full_name !== "Sin nombre"
    ? lead.full_name
    : (lead.phone_e164 ? formatPhoneDisplay(lead.phone_e164) : "Sin nombre")

  // 24h-window evaluation for the compose box — driven by the lead's
  // last INBOUND message, not just the last activity. The bot's own
  // outbound messages don't reopen the window per WA Business policy.
  const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound") ?? null
  const lastInboundAt = lastInbound?.created_at ?? null
  const isWithin24hWindow = !!lastInboundAt && (Date.now() - new Date(lastInboundAt).getTime()) < WA_WINDOW_MS

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Chat header ───────────────────────────────────────────── */}
      <div className="border-b bg-card/95 supports-[backdrop-filter]:bg-card/70 backdrop-blur px-4 py-3 shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile back-arrow returns to the list view. Hidden on
                desktop because the list is always visible there. */}
            <Link
              href="/conversations"
              className="lg:hidden text-muted-foreground hover:text-foreground inline-flex items-center"
              aria-label="Volver a la lista"
            >
              <ArrowLeftIcon className="size-5" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-heading font-semibold truncate">{displayName}</h1>
                <ConversationStatusBadge status={conversation.status} />
              </div>
              {lead.phone_e164 && (
                <p className="text-xs text-muted-foreground font-numeric flex items-center gap-1 mt-0.5">
                  <PhoneIcon className="size-3" />
                  {formatPhoneDisplay(lead.phone_e164)}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LeadProfileSheet>
              <LeadProfileCard lead={lead} mentionedProperty={mentionedProperty} />
            </LeadProfileSheet>
            <ConversationHandoffToggle
              conversationId={conversation.id}
              status={conversation.status}
            />
          </div>
        </div>
      </div>

      {/* ── Message thread (scrolls independently) ────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
        <ConversationThread messages={messages} />
        <ScrollIntoViewOnMount />
      </div>

      {/* ── Compose box (sticky bottom) ───────────────────────────── */}
      <ChatCompose
        conversationId={conversation.id}
        isWithin24hWindow={isWithin24hWindow}
        lastInboundAt={lastInboundAt}
      />
    </div>
  )
}
