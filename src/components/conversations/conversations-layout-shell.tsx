"use client"

import { useSelectedLayoutSegment } from "next/navigation"
import { cn } from "@/lib/utils"

interface Props {
  /** Server-rendered list pane. Always visible on desktop; on mobile
   *  visible only when no conversation is selected (= the empty
   *  state). Passing the list as a JSX prop instead of `children`
   *  keeps the server fetch in the layout and avoids a per-route
   *  refetch. */
  list:     React.ReactNode
  /** The chat pane (page.tsx or [id]/page.tsx output). */
  children: React.ReactNode
}

/**
 * Responsive 3-pane chrome for /conversations.
 *
 * Desktop (lg+): nav (inherited) + list (380px) + chat (flex-1).
 * Mobile: nav | (list XOR chat) depending on URL.
 *
 * Uses `useSelectedLayoutSegment()` so the show/hide state matches
 * the route automatically: `/conversations` → no segment → list
 * fills the viewport; `/conversations/<id>` → segment present →
 * chat fills the viewport on mobile.
 */
export function ConversationsLayoutShell({ list, children }: Props) {
  const segment  = useSelectedLayoutSegment()
  const hasChat  = segment !== null

  return (
    <div className="flex flex-1 -mx-4 sm:-mx-6 -mb-(--spacing-section) -mt-2 min-h-0">
      <aside
        className={cn(
          "w-full lg:w-[380px] flex-col border-r bg-card min-h-0",
          hasChat ? "hidden lg:flex" : "flex",
        )}
      >
        {list}
      </aside>
      <main
        className={cn(
          "flex-1 flex-col min-w-0 min-h-0",
          hasChat ? "flex" : "hidden lg:flex",
        )}
      >
        {children}
      </main>
    </div>
  )
}
