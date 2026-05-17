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

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ConversationDetailPage({ params }: PageProps) {
  const { profile } = await requireAuth()
  const { id }       = await params
  const detail       = await getConversationDetailForUser({ profile, conversationId: id })
  if (!detail) notFound()

  const { conversation, lead, messages, mentionedProperty } = detail
  const displayName = lead.full_name && lead.full_name !== "Sin nombre"
    ? lead.full_name
    : (lead.phone_e164 ? formatPhoneDisplay(lead.phone_e164) : "Sin nombre")

  return (
    <div className="flex flex-col h-full min-h-0 -m-4 lg:-m-6">
      {/* Top bar */}
      <div className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3 lg:px-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/conversations"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
            >
              <ArrowLeftIcon className="size-4" />
              <span className="hidden sm:inline">Volver</span>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-heading font-semibold truncate">{displayName}</h1>
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
          <ConversationHandoffToggle
            conversationId={conversation.id}
            status={conversation.status}
          />
        </div>
      </div>

      {/* Body: thread + profile sidebar */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_22rem] min-h-0">
        {/* Thread */}
        <div className="overflow-y-auto px-4 lg:px-6 py-4 lg:border-r min-h-0">
          <ConversationThread messages={messages} />
        </div>
        {/* Profile sidebar */}
        <aside className="overflow-y-auto bg-muted/30 px-4 lg:px-6 py-4 lg:max-h-[calc(100vh-8rem)]">
          <LeadProfileCard lead={lead} mentionedProperty={mentionedProperty} />
        </aside>
      </div>
    </div>
  )
}
