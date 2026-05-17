import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import {
  ArrowLeftIcon, ArrowTopRightOnSquareIcon, PhoneIcon, UserIcon,
  BuildingOffice2Icon, MapPinIcon, CurrencyDollarIcon,
} from "@heroicons/react/24/outline"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getCandidatesForSearchRequest, type AdvertiserMeta } from "@/lib/search-requests.queries"
import { formatPhoneDisplay } from "@/lib/phone"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { Database } from "@/types/supabase"

type SearchRequest = Database["public"]["Tables"]["search_requests"]["Row"]
type LeadRow       = Database["public"]["Tables"]["leads"]["Row"]

interface PageProps { params: Promise<{ id: string }> }

export default async function SearchRequestDetailPage({ params }: PageProps) {
  await requireAdmin()
  const { id }   = await params
  const supabase = await createClient()

  const reqRes = await supabase
    .from("search_requests")
    .select("*, lead:leads(*)")
    .eq("id", id)
    .maybeSingle()
  if (reqRes.error || !reqRes.data) notFound()
  const req  = reqRes.data as SearchRequest & { lead: LeadRow | null }
  const lead = req.lead

  const candidates = await getCandidatesForSearchRequest(id)

  // Group by confidence band — owners first, agents last. Helps the
  // operator focus on the highest-yield outreach targets.
  const groups = {
    owners:    candidates.filter((c) => (c.advertiser?.confidence ?? 0) >= 0.75),
    likely:    candidates.filter((c) => {
      const cf = c.advertiser?.confidence ?? -1
      return cf >= 0.50 && cf < 0.75
    }),
    agents:    candidates.filter((c) => (c.advertiser?.confidence ?? 1) < 0.50),
    unknown:   candidates.filter((c) => c.advertiser?.confidence == null),
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/external-listings" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeftIcon className="size-4" />
          Volver a búsquedas
        </Link>
        <h1 className="text-2xl font-heading font-bold tracking-tight mt-2">Detalle de búsqueda</h1>
      </div>

      {/* Top context: lead + request meta */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lead</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {lead?.full_name && lead.full_name !== "Sin nombre" && (
              <p className="font-medium">{lead.full_name}</p>
            )}
            {lead?.phone_e164 && (
              <p className="font-numeric text-muted-foreground">{formatPhoneDisplay(lead.phone_e164)}</p>
            )}
            {req.conversation_id && (
              <Link
                href={`/conversations/${req.conversation_id}`}
                className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-2"
              >
                Ver conversación de WhatsApp <ArrowTopRightOnSquareIcon className="size-3" />
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Búsqueda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/40 rounded p-2">
              {JSON.stringify(req.filters, null, 2)}
            </pre>
            <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
              <span>Estado: <Badge variant="secondary">{req.status}</Badge></span>
              <span className="font-numeric">Intentos: {req.scrape_attempts}</span>
              <span className="font-numeric">Candidatos: {req.candidates_count}</span>
              {req.scraped_at && <span>Último scrape: {format(new Date(req.scraped_at), "HH:mm 'del' d/M")}</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Candidate groups */}
      {candidates.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-10">
          {req.status === "pending" || req.status === "scraping"
            ? "El cron aún no ha corrido para esta búsqueda — vuelve en máx 30 minutos."
            : "El scrape no encontró candidatos esta vez. El cron volverá a intentar."}
        </div>
      ) : (
        <div className="space-y-6">
          <CandidateGroup
            title="Probables dueños (alta confianza)"
            subtitle="Anunciantes marcados como «particular» o sin múltiples publicaciones. Contactalos primero."
            tone="primary"
            candidates={groups.owners}
            leadName={lead?.full_name ?? null}
            requestId={req.id}
          />
          <CandidateGroup
            title="Posibles dueños"
            subtitle="Mezcla — pueden ser dueños o pequeños agentes. Vale la pena contactarlos también."
            tone="muted"
            candidates={groups.likely}
            leadName={lead?.full_name ?? null}
            requestId={req.id}
          />
          <CandidateGroup
            title="Agentes / agencias"
            subtitle="Casi seguro son agentes. Para esta cohorte: propuesta de comisión 50/50."
            tone="warn"
            candidates={groups.agents}
            leadName={lead?.full_name ?? null}
            requestId={req.id}
          />
          {groups.unknown.length > 0 && (
            <CandidateGroup
              title="Sin clasificar"
              subtitle="No pudimos extraer info del anunciante. Mirá el link al anuncio original."
              tone="muted"
              candidates={groups.unknown}
              leadName={lead?.full_name ?? null}
              requestId={req.id}
            />
          )}
        </div>
      )}
    </div>
  )
}

interface CandidateGroupProps {
  title:      string
  subtitle:   string
  tone:       "primary" | "muted" | "warn"
  candidates: Awaited<ReturnType<typeof getCandidatesForSearchRequest>>
  leadName:   string | null
  requestId:  string
}

function CandidateGroup({ title, subtitle, tone, candidates, leadName, requestId }: CandidateGroupProps) {
  if (candidates.length === 0) return null
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <h2 className="text-lg font-heading font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <Badge variant={tone === "primary" ? "default" : "outline"} className="font-numeric">
          {candidates.length}
        </Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {candidates.map((c) => (
          <CandidateCard key={c.id} c={c} leadName={leadName} requestId={requestId} />
        ))}
      </div>
    </section>
  )
}

function CandidateCard({
  c, leadName, requestId,
}: {
  c:        Awaited<ReturnType<typeof getCandidatesForSearchRequest>>[number]
  leadName: string | null
  requestId: string
}) {
  const adv = c.advertiser as AdvertiserMeta | null
  return (
    <Card>
      <CardContent className="p-4 space-y-3 text-sm">
        <div className="space-y-1">
          <Link href={c.source_url} target="_blank" rel="noreferrer" className="font-medium hover:underline inline-flex items-center gap-1">
            {c.title}
            <ArrowTopRightOnSquareIcon className="size-3 shrink-0" />
          </Link>
          {c.location_text && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPinIcon className="size-3" />
              {c.location_text}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {c.price != null && (
            <span className="flex items-center gap-1 font-numeric">
              <CurrencyDollarIcon className="size-3 text-muted-foreground" />
              {c.currency === "CRC" ? "₡" : "$"}{c.price.toLocaleString("es-CR")}
              {c.listing_type === "rent" && <span className="text-muted-foreground">/mes</span>}
            </span>
          )}
          {c.bedrooms != null && (
            <span className="font-numeric text-muted-foreground">{c.bedrooms} hab</span>
          )}
          {c.bathrooms != null && (
            <span className="font-numeric text-muted-foreground">{c.bathrooms} baños</span>
          )}
          {c.area_sqm != null && (
            <span className="font-numeric text-muted-foreground">{c.area_sqm} m²</span>
          )}
        </div>

        <Separator />

        {/* Advertiser */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {adv?.role === "particular" ? (
                <UserIcon className="size-4 text-muted-foreground" />
              ) : (
                <BuildingOffice2Icon className="size-4 text-muted-foreground" />
              )}
              <span className="truncate">{adv?.name ?? "Anunciante desconocido"}</span>
            </div>
            {adv?.confidence != null && (
              <Badge
                variant={adv.confidence >= 0.75 ? "default" : adv.confidence >= 0.5 ? "secondary" : "outline"}
                className="font-numeric shrink-0"
              >
                {Math.round(adv.confidence * 100)}% dueño
              </Badge>
            )}
          </div>
          {adv?.phone && (
            <p className="text-xs flex items-center gap-1 font-numeric">
              <PhoneIcon className="size-3" />
              <a href={`https://wa.me/${adv.phone.replace(/[^0-9+]/g, "")}`} target="_blank" rel="noreferrer" className="hover:underline">
                {adv.phone}
              </a>
            </p>
          )}
          {adv?.listings_count != null && (
            <p className="text-xs text-muted-foreground">
              {adv.listings_count} {adv.listings_count === 1 ? "publicación" : "publicaciones"} en E24
            </p>
          )}
          {adv?.profile_url && (
            <Link href={adv.profile_url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Ver perfil del anunciante <ArrowTopRightOnSquareIcon className="size-3" />
            </Link>
          )}
        </div>

        {adv?.phone && (
          <ContactTemplateBox
            advertiserName={adv.name ?? null}
            isOwnerLikely={(adv.confidence ?? 0) >= 0.75}
            leadName={leadName}
            requestId={requestId}
          />
        )}
      </CardContent>
    </Card>
  )
}

/** Pre-baked outreach message the operator can copy-paste into their
 *  WhatsApp until automated outbound (Phase B) is live. Two variants
 *  by confidence — owner-first vs commission-split. */
function ContactTemplateBox({
  advertiserName, isOwnerLikely, leadName,
}: {
  advertiserName: string | null
  isOwnerLikely:  boolean
  leadName:       string | null
  requestId:      string
}) {
  const greeting = advertiserName ? `Hola ${advertiserName.split(" ")[0]},` : "Hola,"
  const interestedLine = leadName && leadName !== "Sin nombre"
    ? `Tenemos un cliente (${leadName}) interesado en una propiedad similar a la suya.`
    : `Tenemos un cliente interesado en una propiedad similar a la suya.`
  const body = isOwnerLikely
    ? `${greeting}

Soy del equipo de easyrent.house. ${interestedLine} Vimos su publicación en Encuentra24 y nos gustaría coordinar una visita / consulta. ¿Sigue disponible?

Si le interesa publicar también con nosotros (sin costo, sin exclusividad), podemos hacerlo en minutos.`
    : `${greeting}

Soy del equipo de easyrent.house. ${interestedLine} Vimos su publicación en Encuentra24. ¿Trabajamos juntos en este caso bajo esquema 50/50 si cierra?

Podemos coordinar y compartir el contacto del cliente cuando confirme interés.`

  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        Ver plantilla para copiar
      </summary>
      <pre className="bg-muted/50 rounded p-2 mt-1 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
        {body}
      </pre>
    </details>
  )
}
