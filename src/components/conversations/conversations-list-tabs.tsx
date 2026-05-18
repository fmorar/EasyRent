"use client"

import { useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatPhoneDisplay } from "@/lib/phone"
import type { ConversationListItem } from "@/lib/conversations.queries"

interface Props {
  items: ConversationListItem[]
}

type Filter = "all" | "unread"

/**
 * Client island for the list pane: tab switching + active-row
 * highlight. The parent layout fetches conversations once, we
 * slice them client-side for "Todas" vs "Sin leer". usePathname
 * tells us which row is currently open so it gets the highlight.
 *
 * Filtering is in-memory rather than via URL search params on
 * purpose — the layout doesn't see search params, and we want
 * the tab state to survive when the user clicks into a chat
 * (which it would if filter state were in the URL pinned to
 * the layout segment).
 */
export function ConversationsListTabs({ items }: Props) {
  const pathname     = usePathname()
  const [filter, setFilter] = useState<Filter>("all")

  const unreadCount = items.reduce((s, i) => s + i.unread_count, 0)
  const visible = useMemo(
    () => filter === "unread" ? items.filter((i) => i.unread_count > 0) : items,
    [items, filter],
  )

  return (
    <>
      <div className="flex border-b">
        <TabBtn active={filter === "all"} onClick={() => setFilter("all")}>
          Todas <span className="font-numeric ml-1 text-muted-foreground">({items.length})</span>
        </TabBtn>
        <TabBtn active={filter === "unread"} onClick={() => setFilter("unread")}>
          Sin leer <span className="font-numeric ml-1 text-muted-foreground">({unreadCount})</span>
        </TabBtn>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center p-8">
            {filter === "unread" ? "Nada sin leer." : "Sin conversaciones."}
          </p>
        ) : (
          <ul className="divide-y">
            {visible.map((item) => (
              <ConversationRowLink key={item.id} item={item} pathname={pathname} />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function TabBtn({
  active, onClick, children,
}: {
  active:   boolean
  onClick:  () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 text-sm py-2.5 border-b-2 -mb-px transition-colors",
        active
          ? "border-primary text-foreground font-medium"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function ConversationRowLink({
  item, pathname,
}: {
  item:     ConversationListItem
  pathname: string
}) {
  const isActive    = pathname.endsWith(`/conversations/${item.id}`)
  const displayName = leadName(item.lead.full_name, item.lead.phone_e164, item.external_id)
  const initials    = makeInitials(displayName)
  const lastTs      = item.last_message?.created_at ?? item.last_message_at
  const ago         = lastTs ? formatDistanceToNow(new Date(lastTs), { addSuffix: false, locale: es }) : ""
  const preview     = item.last_message?.content
    ? clipOneLine(item.last_message.content, 60)
    : null
  const isUnread = item.unread_count > 0

  return (
    <li>
      <Link
        href={`/conversations/${item.id}`}
        className={cn(
          "flex items-start gap-3 px-4 py-3 transition-colors",
          isActive ? "bg-accent" : "hover:bg-accent/50",
        )}
      >
        <Avatar className="size-10 shrink-0 mt-0.5">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className={cn("truncate text-sm", isUnread ? "font-semibold" : "font-medium")}>
              {displayName}
            </span>
            {ago && (
              <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                {ago}
              </span>
            )}
          </div>
          {preview && (
            <p className={cn(
              "text-xs truncate mt-0.5",
              isUnread ? "text-foreground" : "text-muted-foreground",
            )}>
              {item.last_message?.direction === "outbound" && <span className="text-muted-foreground">Vos: </span>}
              {preview}
            </p>
          )}
          <div className="flex items-center justify-between gap-2 mt-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {STATUS_LABEL[item.status]}
            </span>
            {isUnread && (
              <Badge variant="default" className="font-numeric h-4 min-w-4 px-1 text-[10px]">
                {item.unread_count}
              </Badge>
            )}
          </div>
        </div>
      </Link>
    </li>
  )
}

const STATUS_LABEL: Record<ConversationListItem["status"], string> = {
  open:    "Activa",
  pending: "Handoff",
  closed:  "Cerrada",
}

function leadName(name: string | null | undefined, phone: string | null, external: string | null): string {
  if (name && name !== "Sin nombre") return name
  if (phone) return formatPhoneDisplay(phone)
  if (external) return formatPhoneDisplay(external)
  return "Sin nombre"
}

function makeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  const first = parts[0][0] ?? ""
  const last  = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return (first + last).toUpperCase() || "?"
}

function clipOneLine(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, " ").trim()
  return oneLine.length > max ? oneLine.slice(0, max - 1) + "…" : oneLine
}
