import { Badge } from "@/components/ui/badge"
import type { Database } from "@/types/supabase"

type Status = Database["public"]["Enums"]["conversation_status"]

interface Props {
  status:    Status
  className?: string
}

/**
 * Color-coded badge for the three conversation states.
 *   open    → primary  (bot replying normally — the default healthy state)
 *   pending → warning  (handoff to a human; bot is muted)
 *   closed  → muted    (archived; sinks below open threads)
 *
 * Labels render in Spanish — the dashboard is operator-facing and the
 * easyrent team works in CR Spanish. Add an i18n lookup later if we
 * onboard non-Spanish operators.
 */
export function ConversationStatusBadge({ status, className }: Props) {
  const { label, variant } = STATUS_META[status]
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  )
}

const STATUS_META: Record<Status, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open:    { label: "Activa",     variant: "default" },
  pending: { label: "En handoff", variant: "secondary" },
  closed:  { label: "Cerrada",    variant: "outline" },
}
