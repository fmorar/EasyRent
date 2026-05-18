import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import {
  CalendarDaysIcon, ClockIcon, HomeIcon, ArrowTopRightOnSquareIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/outline"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { ActiveVisitRequest } from "@/lib/conversations.queries"

interface Props {
  request: ActiveVisitRequest
}

/**
 * Read-only display of an active visit request in the lead profile.
 *
 * The agent creates these via the `create_visit_request` tool when
 * the gate is complete and the lead confirms. The conversation moves
 * to status='pending' (bot muted) and an operator coordinates the
 * actual time with the owner — this card is what they see when
 * picking up the thread.
 *
 * Future: add inline "Confirmar" / "Cancelar" actions so the
 * operator doesn't need a separate /visit-requests admin page for
 * the common case. v1 keeps it read-only.
 */
export function VisitRequestCard({ request }: Props) {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <CalendarDaysIcon className="size-4 text-primary" />
            Solicitud de visita activa
          </span>
          <Badge variant={request.status === "confirmed" ? "default" : "secondary"}>
            {STATUS_LABEL[request.status] ?? request.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {request.property_title && request.property_slug && (
          <div className="flex items-start gap-2">
            <HomeIcon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Propiedad</p>
              <Link
                href={`/p/${request.property_slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm hover:underline inline-flex items-center gap-1"
              >
                {request.property_title}
                <ArrowTopRightOnSquareIcon className="size-3 shrink-0" />
              </Link>
            </div>
          </div>
        )}
        {!request.property_id && (
          <p className="text-xs text-muted-foreground italic">
            Sin propiedad específica vinculada — el lead pidió coordinar genéricamente. Pareá una propiedad cuando hables con el dueño.
          </p>
        )}

        {(request.preferred_date || request.preferred_time_slot) && (
          <div className="flex items-start gap-2">
            <ClockIcon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Preferencia del lead</p>
              <p className="text-sm">
                {[request.preferred_date, request.preferred_time_slot].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
        )}

        {request.mode === "virtual" && (
          <p className="text-xs flex items-center gap-1 text-muted-foreground">
            <VideoCameraIcon className="size-3" />
            Modalidad virtual (video tour)
          </p>
        )}

        {request.notes && (
          <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">
            &ldquo;{request.notes}&rdquo;
          </p>
        )}

        <p className="text-[11px] text-muted-foreground pt-1">
          Creada {formatDistanceToNow(new Date(request.created_at), { addSuffix: true, locale: es })} · el bot está en pausa hasta que la confirmes
        </p>
      </CardContent>
    </Card>
  )
}

const STATUS_LABEL: Record<string, string> = {
  pending:   "Por coordinar",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
}
