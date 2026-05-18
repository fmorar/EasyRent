import { requireAuth } from "@/lib/auth"
import { listConversationsForUser } from "@/lib/conversations.queries"
import { ConversationsLayoutShell } from "@/components/conversations/conversations-layout-shell"
import { ConversationsListPane } from "@/components/conversations/conversations-list-pane"

/**
 * Shared chrome for /conversations and /conversations/[id].
 *
 * Fetches the conversation list ONCE at this layout boundary so the
 * left pane stays mounted as the user navigates between threads.
 * The right pane (children) swaps via the standard route hierarchy
 * (page.tsx for empty, [id]/page.tsx for a specific thread). The
 * <ConversationsLayoutShell> client wrapper handles the responsive
 * show/hide between list and chat based on the URL segment.
 */
export default async function ConversationsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile } = await requireAuth()
  const items       = await listConversationsForUser({ profile })

  return (
    <ConversationsLayoutShell list={<ConversationsListPane items={items} />}>
      {children}
    </ConversationsLayoutShell>
  )
}
