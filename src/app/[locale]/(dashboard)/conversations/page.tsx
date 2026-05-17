import Link from "next/link"
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline"
import { requireAuth } from "@/lib/auth"
import { listConversationsForUser } from "@/lib/conversations.queries"
import { ConversationRow } from "@/components/conversations/conversation-row"
import { EmptyState } from "@/components/shared/empty-state"
import type { Database } from "@/types/supabase"

type Status = Database["public"]["Enums"]["conversation_status"]

const TABS: Array<{ key: "all" | Status; label: string }> = [
  { key: "all",     label: "Todas" },
  { key: "open",    label: "Activas" },
  { key: "pending", label: "En handoff" },
  { key: "closed",  label: "Cerradas" },
]

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function ConversationsPage({ searchParams }: PageProps) {
  const { profile } = await requireAuth()
  const sp           = await searchParams
  const activeTab    = isStatus(sp.status) ? (sp.status as Status) : "all"

  const items = await listConversationsForUser({
    profile,
    status: activeTab === "all" ? undefined : (activeTab as Status),
  })

  const counts = {
    open:    items.filter((i) => i.status === "open").length,
    pending: items.filter((i) => i.status === "pending").length,
    closed:  items.filter((i) => i.status === "closed").length,
    unread:  items.reduce((s, i) => s + i.unread_count, 0),
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Conversaciones</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mensajes de WhatsApp gestionados por el concierge.
          </p>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <Stat label="Activas"   value={counts.open}    />
          <Stat label="Handoff"   value={counts.pending} />
          <Stat label="Sin leer"  value={counts.unread} highlight={counts.unread > 0} />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b">
        {TABS.map((t) => {
          const active = (t.key === "all" && activeTab === "all") || t.key === activeTab
          const href = t.key === "all" ? "/conversations" : `/conversations?status=${t.key}`
          return (
            <Link
              key={t.key}
              href={href}
              className={`px-3 py-2 text-sm transition-colors border-b-2 -mb-px ${
                active
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          )
        })}
      </div>

      {/* List */}
      {items.length === 0 ? (
        <EmptyState
          icon={<ChatBubbleLeftRightIcon className="size-10" />}
          title="Aún no hay conversaciones"
          message={
            activeTab === "all"
              ? "Cuando alguien escriba por WhatsApp al número del concierge, las conversaciones van a aparecer acá."
              : `No hay conversaciones con estado "${TABS.find((t) => t.key === activeTab)?.label.toLowerCase()}".`
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <ConversationRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="flex flex-col items-end">
      <span
        className={`text-xl font-numeric font-semibold tabular-nums ${
          highlight ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </span>
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  )
}

function isStatus(v: string | undefined): v is Status {
  return v === "open" || v === "pending" || v === "closed"
}
