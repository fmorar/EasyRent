"use client"

import { useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { LEAD_STAGE_LABELS } from "@/lib/labels"
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
  const [query, setQuery]   = useState("")

  const unreadCount = items.reduce((s, i) => s + i.unread_count, 0)

  // Search across the fields a CR operator would naturally type: the
  // lead's name, their phone (with or without dashes/spaces), and the
  // visible content of the last message. Case-insensitive, accents-
  // folded so "escazu" matches "Escazú".
  const visible = useMemo(() => {
    const base = filter === "unread" ? items.filter((i) => i.unread_count > 0) : items
    const q = normalize(query)
    if (!q) return base
    return base.filter((i) => {
      const haystack = [
        i.lead.full_name,
        i.lead.phone_e164,
        i.external_id,
        i.last_message?.content,
      ].map(normalize).join("")
      return haystack.includes(q)
    })
  }, [items, filter, query])

  return (
    <>
      <div className="px-3 py-2 border-b">
        <div className="relative">
          <MagnifyingGlassIcon className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nombre, teléfono o mensaje…"
            className="w-full pl-8 pr-8 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <XMarkIcon className="size-4" />
            </button>
          )}
        </div>
      </div>
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
            {query
              ? `Sin resultados para "${query}".`
              : filter === "unread"
              ? "Nada sin leer."
              : "Sin conversaciones."}
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

/** Accent-fold + lowercase + collapse spaces. Cheap normalization
 *  for natural-language search in Spanish (Escazú == escazu) and
 *  digit-only phone matching (the ILIKE `phone_e164` already keeps
 *  separators stripped). */
function normalize(s: string | null | undefined): string {
  return (s ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
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
            <div className="flex items-center gap-1.5 min-w-0">
              {/* Funnel stage — the macro state, auto-updated by the
                  agent (state-machine.ts). Status (Activa/Handoff)
                  follows as the micro state of the bot itself. */}
              {item.lead.stage && (
                <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-medium uppercase tracking-wider truncate">
                  {LEAD_STAGE_LABELS[item.lead.stage]}
                </Badge>
              )}
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                · {STATUS_LABEL[item.status]}
              </span>
            </div>
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
