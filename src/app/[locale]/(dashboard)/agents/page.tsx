import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getLocale, getTranslations } from "next-intl/server"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { UserPlusIcon } from "@heroicons/react/24/outline"
import { StatTile } from "@/components/shared/stat-tile"
import { RevokeInvitationButton } from "@/components/agent/revoke-invitation-button"
import { ResendInvitationButton } from "@/components/agent/resend-invitation-button"
import type { Profile, Invitation } from "@/types"

/**
 * Merged "team" page: active members + all invitations in one place.
 * Replaces the old split between /agents (active list) and /invitations
 * (full invitation history) — they always answered the same operational
 * question, just from different angles. Keeping them as siblings was
 * just adding clicks for the admin.
 */

type AgentRow = Profile & { inviter: { full_name: string } | null }

type InvitationRow = Invitation & {
  inviter:  { full_name: string } | null
  accepter: { full_name: string } | null
}

export default async function AgentsPage() {
  await requireAdmin()
  const supabase = await createClient()
  const tAgents  = await getTranslations("agents")
  const tInv     = await getTranslations("invitations")
  const locale   = await getLocale()
  const dateLocale = locale === "es" ? "es-CR" : "en-US"

  // ── Members: every non-deleted profile (agent + owner_admin) ─────
  // We include admins on purpose: an "agentes" page that hides admins
  // misrepresents who's on the team. Status badge clarifies the role.
  const { data: membersRaw } = await supabase
    .from("profiles")
    .select(`
      *,
      inviter:profiles!profiles_invited_by_fkey(full_name)
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  const members = membersRaw as AgentRow[] | null

  // ── Invitations: all of them, with the inviter / accepter joins ──
  const { data: invitationsRaw } = await supabase
    .from("invitations")
    .select(`
      *,
      inviter:profiles!invitations_invited_by_fkey(full_name),
      accepter:profiles!invitations_accepted_by_fkey(full_name)
    `)
    .order("created_at", { ascending: false })

  const invitations = invitationsRaw as InvitationRow[] | null

  // Resolve effective status (auto-flag pending+expired as expired)
  const now = new Date()
  const rows = (invitations ?? []).map((inv) => {
    const expired = inv.status === "pending" && new Date(inv.expires_at) < now
    return { ...inv, effectiveStatus: expired ? "expired" : inv.status }
  })

  const counts = {
    members:  members?.length ?? 0,
    pending:  rows.filter((r) => r.effectiveStatus === "pending").length,
    accepted: rows.filter((r) => r.effectiveStatus === "accepted").length,
    expired:  rows.filter((r) => r.effectiveStatus === "expired").length,
    revoked:  rows.filter((r) => r.effectiveStatus === "revoked").length,
  }

  const statusLabel = (s: string) => {
    switch (s) {
      case "pending":  return tInv("statusPending")
      case "accepted": return tInv("statusAccepted")
      case "expired":  return tInv("statusExpired")
      case "revoked":  return tInv("statusRevoked")
      default:         return s
    }
  }

  return (
    <div className="space-y-(--spacing-section)">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
            {tAgents("title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{tAgents("subtitle")}</p>
        </div>
        <Link href="/agents/invite" className={buttonVariants()}>
          <UserPlusIcon className="h-4 w-4 mr-2" />
          {tAgents("invite")}
        </Link>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label={tAgents("active")}        number={counts.members} />
        <StatTile label={tInv("pending")}          number={counts.pending}  highlight />
        <StatTile label={tInv("accepted")}         number={counts.accepted} />
        <StatTile label={tInv("expired")}          number={counts.expired + counts.revoked} muted />
      </div>

      {/* ── Active members ─────────────────────────────────────── */}
      <section className="space-y-(--spacing-cluster)">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {tAgents("active")} ({counts.members})
        </h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tAgents("tableAgent")}</TableHead>
                <TableHead>{tAgents("tableEmail")}</TableHead>
                <TableHead>{tInv("tableRole")}</TableHead>
                <TableHead>{tAgents("tableStatus")}</TableHead>
                <TableHead>{tAgents("invitedBy")}</TableHead>
                <TableHead>{tAgents("joined")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!members?.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {tAgents("noAgents")}
                  </TableCell>
                </TableRow>
              ) : (
                members.map((m) => {
                  const initials = m.full_name
                    .split(" ")
                    .map((n: string) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()

                  return (
                    <TableRow key={m.id} className="transition-colors duration-150 ease-out">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={m.avatar_url ?? undefined} />
                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{m.full_name}</p>
                            <p className="text-xs text-muted-foreground font-numeric">/{m.slug}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{m.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {m.role === "owner_admin" ? tInv("roleAdmin") : tInv("roleAgent")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={m.status === "active" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {m.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.inviter?.full_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground font-numeric">
                        {new Date(m.created_at).toLocaleDateString(dateLocale, {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </section>

      {/* ── Invitations (all statuses) ─────────────────────────── */}
      <section className="space-y-(--spacing-cluster)">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {tInv("title")} ({rows.length})
        </h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tInv("tableEmail")}</TableHead>
                <TableHead>{tInv("tableRole")}</TableHead>
                <TableHead>{tInv("tableInvitedBy")}</TableHead>
                <TableHead>{tInv("tableStatus")}</TableHead>
                <TableHead>{tInv("tableSent")}</TableHead>
                <TableHead>{tInv("tableExpires")}</TableHead>
                <TableHead className="text-right">{tInv("tableActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    {tInv("empty")}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((inv) => (
                  <TableRow key={inv.id} className="transition-colors duration-150 ease-out">
                    <TableCell className="font-medium text-sm">{inv.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {inv.role === "owner_admin" ? tInv("roleAdmin") : tInv("roleAgent")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {inv.inviter?.full_name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          inv.effectiveStatus === "accepted" ? "default"
                          : inv.effectiveStatus === "pending"  ? "secondary"
                          : "outline"
                        }
                        className="text-xs"
                      >
                        {statusLabel(inv.effectiveStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-numeric">
                      {new Date(inv.created_at).toLocaleDateString(dateLocale, {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-numeric">
                      {new Date(inv.expires_at).toLocaleDateString(dateLocale, {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      {inv.effectiveStatus === "pending" && (
                        <div className="flex items-center justify-end gap-1">
                          <ResendInvitationButton
                            invitationId={inv.id}
                            email={inv.email}
                          />
                          <RevokeInvitationButton
                            invitationId={inv.id}
                            email={inv.email}
                          />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  )
}
