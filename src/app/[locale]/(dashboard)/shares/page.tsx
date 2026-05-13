import Link from "next/link"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getLocale, getTranslations } from "next-intl/server"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { ArrowRightIcon, ClockIcon } from "@heroicons/react/24/outline"
import { ShareReviewButtons } from "@/components/sharing/share-review-buttons"
import { AgentChip } from "@/components/shared/agent-chip"
import { StatTile } from "@/components/shared/stat-tile"
import { EmptyState } from "@/components/shared/empty-state"
import { formatCommission } from "@/lib/labels"

interface ShareRow {
  id:                string
  property_id:       string
  status:            "pending" | "approved" | "rejected" | "revoked"
  commission_type:   "percentage" | "fixed" | null
  commission_value:  number | null
  notes:             string | null
  created_at:        string
  property:          { id: string; title: string; slug: string } | null
  shared_by_profile: { id: string; full_name: string; avatar_url: string | null } | null
  shared_with_profile: { id: string; full_name: string; avatar_url: string | null; role: string } | null
}

export default async function SharesPage() {
  const { profile } = await requireAdmin()
  const supabase = await createClient()
  const t        = await getTranslations("shares")
  const locale   = await getLocale()
  const dateLocale = locale === "es" ? "es-CR" : "en-US"

  // Scope explicitly to the current user's shares — ones they sent
  // (shared_by) or received (shared_with). The RLS admin-bypass would
  // otherwise leak every share on the platform into any owner_admin's
  // queue, which is not the workflow the team wants here.
  const { data: sharesRaw } = await supabase
    .from("property_shares")
    .select(`
      id, property_id, status, commission_type, commission_value, notes, created_at,
      property:properties(id, title, slug),
      shared_by_profile:profiles!property_shares_shared_by_fkey(id, full_name, avatar_url),
      shared_with_profile:profiles!property_shares_shared_with_fkey(id, full_name, avatar_url, role)
    `)
    .or(`shared_by.eq.${profile.id},shared_with.eq.${profile.id}`)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  const shares = (sharesRaw ?? []) as unknown as ShareRow[]
  const pending  = shares.filter((s) => s.status === "pending")
  const reviewed = shares.filter((s) => s.status !== "pending")

  const statusLabel = (s: string) => {
    switch (s) {
      case "pending":  return t("statusPending")
      case "approved": return t("statusApproved")
      case "rejected": return t("statusRejected")
      case "revoked":  return t("statusRevoked")
      default:         return s
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(dateLocale, {
      day: "2-digit", month: "short", year: "numeric",
    })

  return (
    <div className="space-y-(--spacing-section)">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-xl">
          {t("subtitle")}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatTile label={t("statPending")} number={pending.length} highlight />
        <StatTile
          label={t("statApproved")}
          number={reviewed.filter((s) => s.status === "approved").length}
        />
        <StatTile
          label={t("statRejected")}
          number={reviewed.filter((s) => s.status === "rejected").length}
          muted
        />
      </div>

      {/* Pending queue */}
      <section className="space-y-(--spacing-cluster)">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {t("pendingQueue")} · <span className="font-numeric">{pending.length}</span>
        </h2>

        {pending.length === 0 ? (
          <EmptyState
            icon={<ClockIcon className="h-8 w-8" />}
            message={t("noPending")}
          />
        ) : (
          <div className="space-y-(--spacing-tight)">
            {pending.map((s) => (
              <PendingRow
                key={s.id}
                share={s}
                viewerId={profile.id}
                commissionLabel={t("commission")}
                waitingLabel={t("waitingOnReceiver")}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </section>

      {/* History */}
      {reviewed.length > 0 && (
        <section className="space-y-(--spacing-cluster)">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("history")} · <span className="font-numeric">{reviewed.length}</span>
          </h2>

          <div className="space-y-(--spacing-tight)">
            {reviewed.slice(0, 25).map((s) => (
              <HistoryRow
                key={s.id}
                share={s}
                statusLabel={statusLabel}
                formatDate={formatDate}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Pending row (fluid: stacks below md, inline above) ──────────
function PendingRow({
  share: s,
  viewerId,
  commissionLabel,
  waitingLabel,
  formatDate,
}: {
  share: ShareRow
  viewerId: string
  commissionLabel: string
  waitingLabel: string
  formatDate: (iso: string) => string
}) {
  // Only the agent the property was shared WITH can approve/reject —
  // the sender would otherwise be reviewing their own request, which
  // defeats the whole purpose of the queue.
  const canReview = s.shared_with_profile?.id === viewerId
  return (
    <Card className="p-4 md:p-3 md:px-5 transition-colors duration-150 ease-out hover:bg-muted/30">
      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-5">
        {/* Property */}
        <div className="md:flex-[2.2] md:min-w-0">
          {s.property ? (
            <Link
              href={`/properties/${s.property.id}`}
              className="text-sm font-medium hover:underline truncate block"
            >
              {s.property.title}
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
          <p className="text-xs text-muted-foreground mt-0.5 font-numeric">
            {formatDate(s.created_at)}
          </p>
        </div>

        {/* From → To */}
        <div className="md:flex-[3] md:min-w-0 flex items-center gap-2 flex-wrap text-sm">
          <AgentChip agent={s.shared_by_profile} />
          <ArrowRightIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <AgentChip agent={s.shared_with_profile} />
        </div>

        {/* Commission */}
        <div className="md:flex-1 md:min-w-0 flex md:flex-col md:items-end items-center gap-2 md:gap-0 pt-3 md:pt-0 border-t md:border-t-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide md:hidden">
            {commissionLabel}
          </p>
          <p className="text-sm font-numeric font-medium">
            {formatCommission(s.commission_type, s.commission_value)}
          </p>
        </div>

        {/* Actions — only the recipient can decide */}
        <div className="md:shrink-0 flex justify-end">
          {canReview ? (
            <ShareReviewButtons shareId={s.id} />
          ) : (
            <span className="text-xs text-muted-foreground italic">
              {waitingLabel}
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}

// ── History row (fluid: stacks below sm, inline above) ──────────
function HistoryRow({
  share: s,
  statusLabel,
  formatDate,
}: {
  share: ShareRow
  statusLabel: (s: string) => string
  formatDate: (iso: string) => string
}) {
  return (
    <Card className="p-3 px-4 transition-colors duration-150 ease-out hover:bg-muted/30">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="sm:flex-[2] min-w-0">
          {s.property ? (
            <Link
              href={`/properties/${s.property.id}`}
              className="text-sm font-medium hover:underline truncate block"
            >
              {s.property.title}
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>

        <div className="sm:flex-[2] flex items-center gap-2 text-xs text-muted-foreground min-w-0 truncate">
          <span className="truncate">{s.shared_by_profile?.full_name ?? "—"}</span>
          <ArrowRightIcon className="h-3 w-3 shrink-0" />
          <span className="truncate">{s.shared_with_profile?.full_name ?? "—"}</span>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 sm:flex-1 sm:shrink-0">
          <Badge
            variant={
              s.status === "approved" ? "default"
              : s.status === "rejected" ? "outline"
              : "secondary"
            }
            className="text-xs"
          >
            {statusLabel(s.status)}
          </Badge>
          <p className="text-xs text-muted-foreground font-numeric">
            {formatDate(s.created_at)}
          </p>
        </div>
      </div>
    </Card>
  )
}
