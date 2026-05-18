"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChatBubbleLeftRightIcon, Squares2X2Icon } from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils"

/**
 * View toggle shared by /leads and /conversations.
 *
 * Why two routes instead of one merged page: each view has very
 * different data fetching shape (kanban needs all leads grouped by
 * stage, chat needs conversations + thread + lead detail) and very
 * different layout (full-page grid vs viewport-bound 3-pane). A
 * single route would duplicate every fetch. The toggle is the
 * connective tissue — same lead funnel, two ways to operate on it.
 *
 * Active state is derived from the URL pathname. usePathname strips
 * the locale prefix, so we just check for the segment.
 */
export function LeadsViewToggle() {
  const pathname = usePathname()
  const onChat   = pathname.startsWith("/conversations")

  return (
    <div className="inline-flex rounded-md border bg-card p-0.5">
      <ToggleLink href="/leads"          active={!onChat} icon={Squares2X2Icon}            label="Tablero" />
      <ToggleLink href="/conversations"  active={onChat}  icon={ChatBubbleLeftRightIcon}  label="Chat" />
    </div>
  )
}

function ToggleLink({
  href, active, icon: Icon, label,
}: {
  href:   string
  active: boolean
  icon:   React.ElementType
  label:  string
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded text-sm transition-colors",
        active
          ? "bg-primary text-primary-foreground font-medium"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  )
}
