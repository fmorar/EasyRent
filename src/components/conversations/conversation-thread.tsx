import { format, isSameDay } from "date-fns"
import { es } from "date-fns/locale"
import { MessageBubble } from "./message-bubble"
import type { Database } from "@/types/supabase"

type Message = Database["public"]["Tables"]["conversation_messages"]["Row"]

interface Props {
  messages: Message[]
}

/**
 * Render the chat thread top-down (oldest first) with WhatsApp-style
 * day separators when the date changes. We don't auto-scroll on
 * server-rendered pages — the user's natural reading flow handles that
 * — but the layout puts the latest message at the bottom of the
 * container so it's where the eye lands.
 */
export function ConversationThread({ messages }: Props) {
  if (messages.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        Aún no hay mensajes en esta conversación.
      </div>
    )
  }

  const rendered: React.ReactNode[] = []
  let lastDate: Date | null = null
  for (const m of messages) {
    const ts = m.created_at ? new Date(m.created_at) : null
    if (ts && (!lastDate || !isSameDay(ts, lastDate))) {
      rendered.push(
        <div key={`day-${m.id}`} className="flex justify-center my-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground bg-background px-2 py-0.5 rounded-full border">
            {format(ts, "EEEE d 'de' MMMM", { locale: es })}
          </span>
        </div>,
      )
      lastDate = ts
    }
    rendered.push(<MessageBubble key={m.id} message={m} />)
  }

  return <div className="flex flex-col gap-2 py-2">{rendered}</div>
}
