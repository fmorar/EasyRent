import Link from "next/link"
import { requireAuth } from "@/lib/auth"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  ChartBarSquareIcon,
  FunnelIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline"

/**
 * Coming-soon placeholder for /leads.
 *
 * The kanban pipeline + lead detail flow wasn't ready for production
 * yet, so we surface a clear "Pronto" state rather than route users
 * to a broken page. Dashboard tiles still link here on purpose — the
 * preview helps users understand what's being built next.
 */
export default async function LeadsPage() {
  // Keep the auth gate so anon visitors still get bounced to login —
  // the page itself is harmless to render, but consistent routing
  // protects deep-linked URLs.
  await requireAuth()

  return (
    <div className="space-y-(--spacing-section)">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
            Leads
          </h1>
          <Badge variant="outline" className="text-[10px] uppercase tracking-[0.16em]">
            Pronto
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Estamos terminando el pipeline de leads. Mientras tanto, podés
          seguir gestionando consultas desde WhatsApp y correo.
        </p>
      </header>

      <Card>
        <CardContent className="py-12 sm:py-16 px-6 sm:px-10 flex flex-col items-center text-center gap-(--spacing-cluster)">
          <span className="h-14 w-14 rounded-2xl bg-primary/15 text-foreground flex items-center justify-center">
            <FunnelIcon className="h-7 w-7" />
          </span>
          <div className="space-y-(--spacing-tight) max-w-md">
            <h2 className="text-xl sm:text-2xl font-heading font-semibold tracking-tight">
              Pipeline de leads en construcción
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Estamos puliendo el kanban, la asignación automática y el
              seguimiento por etapa. Pronto vas a poder mover leads, ver
              el embudo completo y exportar reportes desde acá.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-(--spacing-tight) w-full max-w-2xl pt-(--spacing-block)">
            <PreviewTile
              icon={<ChartBarSquareIcon className="h-4 w-4" />}
              title="Embudo por etapa"
              body="Nuevo · Contactado · Visita · Oferta · Cerrado."
            />
            <PreviewTile
              icon={<ChatBubbleLeftRightIcon className="h-4 w-4" />}
              title="Captura unificada"
              body="WhatsApp, formularios públicos y links sin marca en un mismo lugar."
            />
            <PreviewTile
              icon={<ClockIcon className="h-4 w-4" />}
              title="Recordatorios"
              body="Próximos pasos y SLA por lead para que nada se enfríe."
            />
          </div>

          <div className="pt-(--spacing-block)">
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1.5" />
              Volver al panel
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function PreviewTile({
  icon, title, body,
}: {
  icon:  React.ReactNode
  title: string
  body:  string
}) {
  return (
    <div className="rounded-xl border bg-muted/20 px-4 py-4 text-left space-y-1.5">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium text-foreground">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {body}
      </p>
    </div>
  )
}
