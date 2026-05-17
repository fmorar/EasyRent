import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { MagnifyingGlassIcon, ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline"
import { requireAdmin } from "@/lib/auth"
import { listSearchRequests } from "@/lib/search-requests.queries"
import { formatPhoneDisplay } from "@/lib/phone"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"

/**
 * Admin surface for the "I'll get back to you" loop.
 *
 * Every row here is a search_request — a lead asked for something
 * we couldn't satisfy, the bot promised follow-up, the cron scraped
 * Encuentra24 with enrichment, and we have N candidates ready for
 * a human to act on (contact owner, claim listing, message lead).
 *
 * Until WhatsApp Business templates are approved, this is the manual
 * cockpit: pick a candidate, copy phone, send outreach from your own
 * WhatsApp, capture consent, claim the row. Phase B automates the
 * outbound side without changing this UI.
 */
export default async function ExternalListingsPage() {
  await requireAdmin()
  const requests = await listSearchRequests()

  const stats = {
    open:      requests.filter((r) => r.status === "pending" || r.status === "scraping").length,
    completed: requests.filter((r) => r.status === "completed").length,
    fulfilled: requests.filter((r) => r.status === "fulfilled").length,
    candidates: requests.reduce((s, r) => s + r.candidates_count, 0),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Búsquedas activas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Leads que pidieron algo que no tenemos. El bot prometió volver con novedades; el cron va trayendo candidatos de Encuentra24 con teléfono del anunciante.
          </p>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <Stat label="Abiertas"      value={stats.open} />
          <Stat label="Con candidatos" value={stats.completed} highlight={stats.completed > 0} />
          <Stat label="Cerradas"      value={stats.fulfilled} />
          <Stat label="Cands. totales" value={stats.candidates} />
        </div>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          icon={<MagnifyingGlassIcon className="size-10" />}
          title="Sin búsquedas activas"
          message="Cuando el bot no encuentre nada en el catálogo, se va a abrir una búsqueda acá y el cron va a empezar a traer candidatos de Encuentra24."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map((r) => (
            <RequestRow key={r.id} req={r} />
          ))}
        </div>
      )}
    </div>
  )
}

function RequestRow({ req }: { req: Awaited<ReturnType<typeof listSearchRequests>>[number] }) {
  const f = req.filters as {
    listing_type?:  string
    property_type?: string
    zones?:         string[]
    min_price?:     number
    max_price?:     number
    currency?:      string
    min_bedrooms?:  number
    max_bedrooms?:  number
    furnished?:     boolean
  }
  const summary = describeFilters(f)

  return (
    <Link
      href={`/external-listings/${req.id}`}
      className="block rounded-lg border bg-card hover:bg-accent/50 transition-colors p-4"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={req.status} />
            {req.candidates_count > 0 && (
              <Badge variant="default" className="font-numeric">
                {req.candidates_count} cand.
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(req.created_at), { addSuffix: true, locale: es })}
            </span>
          </div>
          <p className="text-sm mt-1 truncate">{summary}</p>
          {req.lead && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
              <span>{req.lead.full_name && req.lead.full_name !== "Sin nombre" ? req.lead.full_name : "Lead sin nombre"}</span>
              {req.lead.phone_e164 && (
                <span className="font-numeric">{formatPhoneDisplay(req.lead.phone_e164)}</span>
              )}
              {req.conversation_id && (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1">
                    <ChatBubbleLeftRightIcon className="size-3" />
                    Conversación activa
                  </span>
                </>
              )}
            </p>
          )}
        </div>
        <div className="text-right text-xs text-muted-foreground shrink-0">
          {req.scraped_at ? (
            <p>Scrape {formatDistanceToNow(new Date(req.scraped_at), { addSuffix: true, locale: es })}</p>
          ) : (
            <p>Sin scrape aún</p>
          )}
          <p>Intentos: <span className="font-numeric">{req.scrape_attempts}</span></p>
        </div>
      </div>
    </Link>
  )
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="flex flex-col items-end">
      <span className={`text-xl font-numeric font-semibold tabular-nums ${highlight ? "text-primary" : "text-foreground"}`}>
        {value}
      </span>
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.unknown
  return <Badge variant={meta.variant}>{meta.label}</Badge>
}

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending:   { label: "Pendiente",         variant: "secondary" },
  scraping:  { label: "Buscando…",         variant: "secondary" },
  completed: { label: "Candidatos listos", variant: "default" },
  fulfilled: { label: "Cerrada",           variant: "outline" },
  failed:    { label: "Falló",             variant: "destructive" },
  expired:   { label: "Expirada",          variant: "outline" },
  unknown:   { label: "?",                 variant: "outline" },
}

/** Render the search filters in a readable single line. */
function describeFilters(f: {
  listing_type?:  string
  property_type?: string
  zones?:         string[]
  min_price?:     number
  max_price?:     number
  currency?:      string
  min_bedrooms?:  number
  max_bedrooms?:  number
  furnished?:     boolean
}): string {
  const parts: string[] = []
  if (f.listing_type)    parts.push(f.listing_type === "rent" ? "alquiler" : "venta")
  if (f.property_type)   parts.push(f.property_type === "apartment" ? "apartamento" : f.property_type)
  if (f.min_bedrooms != null || f.max_bedrooms != null) {
    const range = f.min_bedrooms != null && f.max_bedrooms != null && f.min_bedrooms === f.max_bedrooms
      ? `${f.min_bedrooms} hab`
      : `${f.min_bedrooms ?? "?"}-${f.max_bedrooms ?? "?"} hab`
    parts.push(range)
  }
  if (f.zones?.length)   parts.push(`en ${f.zones.join(", ")}`)
  if (f.max_price != null) {
    const cur = f.currency === "CRC" ? "₡" : "$"
    parts.push(`hasta ${cur}${f.max_price.toLocaleString("es-CR")}`)
  }
  if (f.furnished === true)  parts.push("amueblado")
  if (f.furnished === false) parts.push("sin muebles")
  return parts.length ? parts.join(" · ") : "(sin filtros)"
}
