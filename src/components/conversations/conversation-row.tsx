import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ConversationStatusBadge } from "./conversation-status-badge"
import { formatPhoneDisplay } from "@/lib/phone"
import type { ConversationListItem } from "@/lib/conversations.queries"

interface Props {
  item: ConversationListItem
}

/**
 * One row on the conversations list page.
 *
 * Layout: avatar · (name + phone, last message preview) · (relative
 * time + status badge + unread dot). The whole row is a Link to
 * /conversations/<id> so we keep tab-key navigation working and
 * cmd-click opens the thread in a new tab.
 *
 * Last-message preview is collapsed to one line and trimmed at ~80
 * chars. Audio messages were transcribed before persistence, so the
 * preview reads as plain Spanish text rather than "[media]".
 */
export function ConversationRow({ item }: Props) {
  const displayName = displayLeadName(item.lead.full_name, item.lead.phone_e164)
  const phoneDisplay = item.lead.phone_e164
    ? formatPhoneDisplay(item.lead.phone_e164)
    : item.external_id ?? ""
  const initials = makeInitials(displayName)
  const lastTs = item.last_message?.created_at ?? item.last_message_at
  const lastAgo = lastTs
    ? formatDistanceToNow(new Date(lastTs), { addSuffix: true, locale: es })
    : ""

  const preview = previewFor(item)
  const isUnread = item.unread_count > 0

  return (
    <Link
      href={`/conversations/${item.id}`}
      className="flex items-center gap-4 px-4 py-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
    >
      <Avatar className="size-10 shrink-0">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className={`truncate ${isUnread ? "font-semibold" : "font-medium"}`}>
            {displayName}
          </span>
          {phoneDisplay && phoneDisplay !== displayName && (
            <span className="text-xs text-muted-foreground font-numeric truncate">
              {phoneDisplay}
            </span>
          )}
        </div>
        {preview && (
          <p className={`text-sm truncate mt-0.5 ${isUnread ? "text-foreground" : "text-muted-foreground"}`}>
            {item.last_message?.direction === "outbound" && (
              <span className="text-muted-foreground">Vos: </span>
            )}
            {preview}
          </p>
        )}
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        {lastAgo && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">{lastAgo}</span>
        )}
        <div className="flex items-center gap-2">
          {isUnread && (
            <span className="bg-primary text-primary-foreground text-[10px] font-semibold font-numeric rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">
              {item.unread_count}
            </span>
          )}
          <ConversationStatusBadge status={item.status} />
        </div>
      </div>
    </Link>
  )
}

function displayLeadName(name: string | null | undefined, phone: string | null): string {
  if (name && name !== "Sin nombre") return name
  if (phone) return formatPhoneDisplay(phone)
  return "Sin nombre"
}

function makeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  const first = parts[0][0] ?? ""
  const last  = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return (first + last).toUpperCase() || "?"
}

function previewFor(item: ConversationListItem): string | null {
  const content = item.last_message?.content
  if (!content) return null
  const oneLine = content.replace(/\s+/g, " ").trim()
  return oneLine.length > 80 ? oneLine.slice(0, 77) + "…" : oneLine
}
