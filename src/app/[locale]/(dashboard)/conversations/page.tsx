import { requireAuth } from "@/lib/auth"
import { ChatEmptyState } from "@/components/conversations/chat-empty-state"

/**
 * Right-pane content when no conversation is selected.
 *
 * The auth gate is intentional — the layout above ALSO calls
 * requireAuth, but a page-level call keeps the route safe even if a
 * future refactor moves data out of the layout.
 *
 * Desktop: this empty state shows next to the list pane.
 * Mobile: the layout shell hides the chat pane when no segment is
 * selected, so this empty state is never rendered on small screens
 * — the user just sees the list.
 */
export default async function ConversationsIndexPage() {
  await requireAuth()
  return <ChatEmptyState />
}
