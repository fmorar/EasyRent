import Link from "next/link"
import {
  UserIcon, PhoneIcon, EnvelopeIcon, HomeIcon, CurrencyDollarIcon,
  MapPinIcon, CalendarIcon, IdentificationIcon, BriefcaseIcon, UsersIcon,
  CheckCircleIcon, ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { formatPhoneDisplay } from "@/lib/phone"
import { ThreadSummaryCard } from "./thread-summary-card"
import type { AgentSearchResult } from "@/lib/whatsapp-agent/property-search"
import type { Database } from "@/types/supabase"

type LeadRow = Database["public"]["Tables"]["leads"]["Row"]

interface Props {
  lead:              LeadRow
  mentionedProperty: AgentSearchResult | null
  /** Conversation id is required so the AI-summary card can call the
   *  regenerate server action. Optional only because some callers
   *  render the profile without a thread context. */
  conversationId?:   string
}

/**
 * Right-side info panel on the conversation detail page.
 *
 * Two purposes:
 *   1. Mirror the agent's "Perfil del lead" snapshot so operators see
 *      the same context the bot is using — same fields, same labels.
 *      If a value changed via update_lead_profile, it shows here.
 *   2. Surface the visit-gate progress (6 mandatory facts the CR
 *      landlord asks for) as a checklist so the operator knows what's
 *      missing before scheduling.
 *
 * The mentioned property card at the top is the same /p/<slug>
 * pre-resolution the agent does — keeps the dashboard's mental
 * model 1:1 with the bot's.
 */
export function LeadProfileCard({ lead, mentionedProperty, conversationId }: Props) {
  const extracted = (lead.extracted_data ?? null) as
    | {
        preferred_zones?:           string[]
        id_number?:                 string | null
        parking_needed?:            boolean | null
        parking_count?:             number  | null
        occupation?:                string  | null
        thread_summary?:            string  | null
        thread_summary_updated_at?: string  | null
      }
    | null
  const preferredZones = Array.isArray(extracted?.preferred_zones)
    ? extracted!.preferred_zones.filter((z): z is string => typeof z === "string")
    : []
  const idNumber       = extracted?.id_number   ?? null
  const parkingNeeded  = typeof extracted?.parking_needed === "boolean" ? extracted.parking_needed : null
  const parkingCount   = typeof extracted?.parking_count  === "number"  ? extracted.parking_count  : null
  const occupation     = extracted?.occupation  ?? null

  const namePending = !lead.full_name || lead.full_name === "Sin nombre"

  // Visit gate — 6 mandatory CR-rental facts. Match the agent's
  // missingForVisit logic in src/lib/whatsapp-agent/state.ts.
  const visitGateChecks = [
    { key: "name",     label: "Nombre completo",            done: !namePending },
    { key: "id",       label: "Identificación",             done: !!idNumber },
    { key: "party",    label: "Cuántas personas",           done: lead.party_size != null },
    { key: "pets",     label: "Mascotas",                   done: !!lead.has_pets },
    { key: "parking",  label: "Parqueo",                    done: parkingNeeded != null },
    { key: "job",      label: "Profesión / trabajo",        done: !!occupation },
  ]
  const visitGateDone = visitGateChecks.filter((c) => c.done).length

  const threadSummary       = extracted?.thread_summary             ?? null
  const threadSummaryUpdatedAt = extracted?.thread_summary_updated_at ?? null

  return (
    <div className="space-y-4">
      {/* AI summary — operator-facing brief, also re-used by the agent
          on its next turn (state.ts reads thread_summary from this
          same JSONB key). Only render when we know the conversation
          id; otherwise the regenerate action has no target. */}
      {conversationId && (
        <ThreadSummaryCard
          conversationId={conversationId}
          initialSummary={threadSummary}
          initialUpdatedAt={threadSummaryUpdatedAt}
        />
      )}

      {/* Lead identity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserIcon className="size-4" />
            Lead
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Field icon={UserIcon} label="Nombre">
            {namePending ? <span className="text-muted-foreground italic">Sin nombre aún</span> : lead.full_name}
          </Field>
          {lead.phone_e164 && (
            <Field icon={PhoneIcon} label="WhatsApp">
              <span className="font-numeric">{formatPhoneDisplay(lead.phone_e164)}</span>
            </Field>
          )}
          {lead.email && (
            <Field icon={EnvelopeIcon} label="Correo">{lead.email}</Field>
          )}
          {idNumber && (
            <Field icon={IdentificationIcon} label="Identificación">
              <span className="font-numeric">{idNumber}</span>
            </Field>
          )}
          {occupation && (
            <Field icon={BriefcaseIcon} label="Profesión / trabajo">{occupation}</Field>
          )}
          <Separator className="my-2" />
          <Link
            href={`/leads`}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            Ver lead en CRM <ArrowTopRightOnSquareIcon className="size-3" />
          </Link>
        </CardContent>
      </Card>

      {/* Discovery / preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Búsqueda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {lead.inquiry_type && (
            <Field icon={HomeIcon} label="Intención">{INQUIRY_LABELS[lead.inquiry_type]}</Field>
          )}
          {lead.budget_range && (
            <Field icon={CurrencyDollarIcon} label="Presupuesto">{BUDGET_LABELS[lead.budget_range]}</Field>
          )}
          {lead.move_in_window && (
            <Field icon={CalendarIcon} label="Mudanza">{MOVE_IN_LABELS[lead.move_in_window]}</Field>
          )}
          {preferredZones.length > 0 && (
            <Field icon={MapPinIcon} label="Zonas">
              <span>{preferredZones.join(", ")}</span>
            </Field>
          )}
          {lead.party_size != null && (
            <Field icon={UsersIcon} label="Personas">
              <span className="font-numeric">{lead.party_size}</span>
            </Field>
          )}
          {lead.has_pets && (
            <Field icon={HomeIcon} label="Mascotas">{PETS_LABELS[lead.has_pets]}</Field>
          )}
          {parkingNeeded != null && (
            <Field icon={HomeIcon} label="Parqueo">
              {parkingNeeded
                ? `Sí${parkingCount ? ` · ${parkingCount} carro${parkingCount === 1 ? "" : "s"}` : ""}`
                : "No necesita"}
            </Field>
          )}
          {!lead.inquiry_type && !lead.budget_range && preferredZones.length === 0 && (
            <p className="text-muted-foreground text-xs italic">Aún no se ha capturado info de búsqueda.</p>
          )}
        </CardContent>
      </Card>

      {/* Visit-gate checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Datos para visita</span>
            <Badge variant={visitGateDone === 6 ? "default" : "secondary"} className="font-numeric">
              {visitGateDone}/6
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          {visitGateChecks.map((c) => (
            <div key={c.key} className="flex items-center gap-2">
              <CheckCircleIcon
                className={c.done ? "size-4 text-primary" : "size-4 text-muted-foreground/40"}
              />
              <span className={c.done ? "" : "text-muted-foreground"}>{c.label}</span>
            </div>
          ))}
          {visitGateDone < 6 && (
            <p className="text-xs text-muted-foreground italic pt-1">
              El bot está pidiendo estos datos antes de ofrecer agendar visita.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Mentioned property — what the bot saw last */}
      {mentionedProperty && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Propiedad mencionada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Link href={mentionedProperty.url} target="_blank" rel="noreferrer" className="block group">
              <p className="font-medium group-hover:underline">{mentionedProperty.title}</p>
              {mentionedProperty.price != null && (
                <p className="text-muted-foreground text-xs font-numeric mt-0.5">
                  {formatNativeAndAlt(mentionedProperty)}
                  {mentionedProperty.listing_type === "rent" && " / mes"}
                </p>
              )}
              {mentionedProperty.display_address && (
                <p className="text-muted-foreground text-xs mt-0.5 truncate">{mentionedProperty.display_address}</p>
              )}
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-1">
                Ver en sitio <ArrowTopRightOnSquareIcon className="size-3" />
              </span>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Field({
  icon: Icon, label, children,
}: {
  icon:    React.ElementType
  label:   string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  )
}

function formatNativeAndAlt(p: AgentSearchResult): string {
  if (p.price == null) return ""
  const fmt = new Intl.NumberFormat("es-CR")
  if (p.currency === "CRC") {
    const native = `₡${fmt.format(p.price)}`
    return p.price_in_usd != null ? `${native} (≈ $${fmt.format(p.price_in_usd)})` : native
  }
  if (p.currency === "USD") {
    const native = `$${fmt.format(p.price)}`
    return p.price_in_crc != null ? `${native} (≈ ₡${fmt.format(p.price_in_crc)})` : native
  }
  return `${p.currency ?? ""} ${fmt.format(p.price)}`.trim()
}

// Label maps — match the ones in src/lib/whatsapp-agent/state.ts so
// the dashboard reads identically to the agent's prompt context.

const INQUIRY_LABELS: Record<NonNullable<LeadRow["inquiry_type"]>, string> = {
  availability: "Consultar disponibilidad",
  visit:        "Coordinar visita",
  info:         "Información general",
}
const MOVE_IN_LABELS: Record<NonNullable<LeadRow["move_in_window"]>, string> = {
  immediate:           "Inmediato",
  one_month:           "Menos de 1 mes",
  one_to_three_months: "1 a 3 meses",
  three_to_six_months: "3 a 6 meses",
  browsing:            "Solo investigando",
}
const BUDGET_LABELS: Record<NonNullable<LeadRow["budget_range"]>, string> = {
  under_1000:         "Menos de $1.000",
  between_1000_1500:  "$1.000 – $1.500",
  between_1500_2000:  "$1.500 – $2.000",
  between_2000_3000:  "$2.000 – $3.000",
  above_3000:         "Más de $3.000",
}
const PETS_LABELS: Record<NonNullable<LeadRow["has_pets"]>, string> = {
  none:      "Sin mascotas",
  small_dog: "Perro pequeño",
  large_dog: "Perro grande",
  cat:       "Gato",
  multiple:  "Varias mascotas",
}
