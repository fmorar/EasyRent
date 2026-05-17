import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import {
  ArrowLeftIcon, ArrowTopRightOnSquareIcon, PhoneIcon, UserIcon,
  BuildingOffice2Icon, MapPinIcon, CurrencyDollarIcon,
  ChatBubbleLeftIcon,
} from "@heroicons/react/24/outline"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getCandidatesForSearchRequest, type AdvertiserMeta } from "@/lib/search-requests.queries"
import { formatPhoneDisplay } from "@/lib/phone"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { CopyTemplateButton } from "@/components/external-listings/copy-template-button"
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
          <OutreachActions
            phone={adv.phone}
            advertiserName={adv.name ?? null}
            listingType={c.listing_type as "rent" | "sale" | null}
            listingTitle={c.title}
          />
        )}
      </CardContent>
    </Card>
  )
}

interface OutreachActionsProps {
  phone:          string
  advertiserName: string | null
  listingType:    "rent" | "sale" | null
  listingTitle:   string
}

/**
 * Per-candidate outreach affordances:
 *   1. Renders the pre-baked first-contact message (our copy, the
 *      one we agreed on with sales — owner intro, service scope,
 *      commission disclosed up front).
 *   2. "Abrir en WhatsApp" deep-links to wa.me with the message
 *      already typed; operator clicks Send.
 *   3. "Copiar texto" for the (rare) case where the operator wants
 *      to paste into a different client (WhatsApp Business app,
 *      WhatsApp Web tab they already had open with the lead, etc.).
 *
 * Important: we never leak the lead's phone or name to the owner in
 * this first contact. The pitch is "tengo un cliente interesado" —
 * the owner reaches back out to us first and we mediate.
 *
 * Stays in sync with the user's specified script. When Phase B lands
 * (Twilio-approved WA Business templates), the body here is what
 * gets submitted to Meta for approval.
 */
function OutreachActions({
  phone, advertiserName, listingType, listingTitle,
}: OutreachActionsProps) {
  const body  = buildOutreachMessage({ advertiserName, listingType, listingTitle })
  const waUrl = `https://wa.me/${phone.replace(/[^0-9+]/g, "").replace(/^\+/, "")}?text=${encodeURIComponent(body)}`

  return (
    <div className="space-y-2 pt-1">
      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
          Ver plantilla
        </summary>
        <pre className="bg-muted/50 rounded p-2 mt-1 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
          {body}
        </pre>
      </details>
      <div className="flex items-center gap-2">
        <a
          href={waUrl}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: "default", size: "sm" }))}
        >
          <ChatBubbleLeftIcon className="size-4" />
          Abrir en WhatsApp
        </a>
        <CopyTemplateButton text={body} />
      </div>
    </div>
  )
}

/**
 * Build the first-contact outreach body.
 *
 * Script (per sales): warm greeting → name the listing → state the
 * interest → ask if they want us to offer it → ask if they've worked
 * with agents → disclose commission → list service inclusions.
 *
 * Two commission variants:
 *   • rent  → equivalente a un mes de renta
 *   • sale  → 3% del precio de venta (CR market standard for the
 *             seller's-side agent; the buyer's-side cut is separate)
 *   • null  → generic "comisión estándar, te la confirmo en el chat"
 *
 * Uses "tenés" (voseo) to match the easyrent brand voice across the
 * funnel — even on first contact. Operators should feel free to
 * adjust in their WA client before sending if they have a personal
 * relationship with the owner.
 */
function buildOutreachMessage({
  advertiserName, listingType, listingTitle,
}: {
  advertiserName: string | null
  listingType:    "rent" | "sale" | null
  listingTitle:   string
}): string {
  const firstName = advertiserName?.split(/\s+/)[0]?.trim() || null
  const greeting  = firstName ? `Hola ${firstName},` : "Hola,"
  const commissionLine = listingType === "rent"
    ? "Nuestra comisión por el servicio es el equivalente a un mes de renta."
    : listingType === "sale"
    ? "Nuestra comisión por el servicio es el 3% del precio de venta."
    : "Te confirmo la comisión por el servicio cuando me digas si te interesa avanzar."

  return `${greeting}

Soy del equipo de easyrent.house. Vi que tenés esta propiedad disponible:

${listingTitle}

Tengo un cliente interesado en una propiedad similar y me gustaría saber si te interesa que se la ofrezca formalmente. También, ¿has trabajado con agentes antes?

${commissionLine}

Dentro del servicio incluye:
- Datum (revisión de antecedentes del cliente)
- Perfilamiento del cliente
- Elaboración del contrato
- Toma de fotografías y material audiovisual de ser necesario

Si te interesa, contestame por acá y coordinamos los próximos pasos.`
}
