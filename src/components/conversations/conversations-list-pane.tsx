import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline"
import { EmptyState } from "@/components/shared/empty-state"
import { LeadsViewToggle } from "@/components/leads/leads-view-toggle"
import { ConversationsListTabs } from "./conversations-list-tabs"
import type { ConversationListItem } from "@/lib/conversations.queries"

interface Props {
  items: ConversationListItem[]
}

/**
 * Left rail content: header + tabs + scrollable list of rows.
 *
 * Rendered once at the layout level and shared across every
 * conversation detail route. Client-side filtering happens in
 * <ConversationsListTabs> — we pass all items down, it slices.
 */
export function ConversationsListPane({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <ListHeader unreadCount={0} totalCount={0} />
        <div className="flex-1 overflow-y-auto p-4">
          <EmptyState
            icon={<ChatBubbleLeftRightIcon className="size-8" />}
            title="Aún no hay conversaciones"
            message="Cuando alguien escriba por WhatsApp al concierge, va a aparecer acá."
            bare
          />
        </div>
      </div>
    )
  }

  const totalCount  = items.length
  const unreadCount = items.reduce((s, i) => s + i.unread_count, 0)

  return (
    <div className="flex flex-col h-full min-h-0">
      <ListHeader unreadCount={unreadCount} totalCount={totalCount} />
      <ConversationsListTabs items={items} />
    </div>
  )
}

function ListHeader({ unreadCount, totalCount }: { unreadCount: number; totalCount: number }) {
  return (
    <div className="px-4 py-3 border-b space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-heading font-semibold">Conversaciones</h2>
        <span className="text-xs text-muted-foreground font-numeric">
          {totalCount} total{totalCount === 1 ? "" : "es"}
          {unreadCount > 0 && <> · <span className="text-primary">{unreadCount} sin leer</span></>}
        </span>
      </div>
      <LeadsViewToggle />
    </div>
  )
}
