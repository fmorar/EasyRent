import { requireAuth } from "@/lib/auth"
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
import { UnlinkAgentButton } from "@/components/agent/unlink-agent-button"
import type { Profile, Invitation } from "@/types"

/**
 * "Personas" — merged team page combining active members and the
 * invitation log. A single table answers the operational question
 * "who's on my team and what's their status".
 *
 *   Estado = "Activo"        → profile exists, person can log in
 *           "Pendiente"      → invitation sent, not yet accepted (and not expired)
 *           "Expirada"       → invitation past expires_at, never accepted
 *           "Revocada"       → admin revoked the invitation manually
 *
 * Actions per row depend on the viewer's relationship to the person:
 *   • If status=Activo AND I'm their inviter → Desvincular
 *   • If status=Pendiente AND I'm the inviter → Reenviar + Revocar
 *   • Everything else → no actions
 */

type ProfileRow = Profile & { inviter: { full_name: string } | null }
type InvitationRow = Invitation & {
  inviter:  { full_name: string } | null
  accepter: { id: string; full_name: string; slug: string | null; avatar_url: string | null } | null
}

interface PersonRow {
  key:           string
  status:        "active" | "pending" | "expired" | "revoked"
  email:         string
  full_name:     string | null
  avatar_url:    string | null
  slug:          string | null
  role:          string
  inviter_name:  string | null
  date:          string       // joined_at for active, sent_at for invitations
  expires_at:    string | null
  /** Profile id when status=active. */
  profile_id:    string | null
  /** Invitation id when row originated from invitations table. */
  invitation_id: string | null
  /** Viewer's relationship — controls which actions render. */
  is_self:       boolean
  i_invited:     boolean
}

export default async function AgentsPage() {
  const { profile } = await requireAuth()
  const supabase = await createClient()
  const tAgents  = await getTranslations("agents")
  const tInv     = await getTranslations("invitations")
  const locale   = await getLocale()
  const dateLocale = locale === "es" ? "es-CR" : "en-US"

  // ── Members (profiles I'm linked to) ───────────────────────────
  const { data: membersRaw } = await supabase
    .from("profiles")
    .select(`
      *,
      inviter:profiles!profiles_invited_by_fkey(full_name)
    `)
    .or(`invited_by.eq.${profile.id},id.eq.${profile.id}`)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  const members = (membersRaw ?? []) as unknown as ProfileRow[]

  // ── Invitations I sent ─────────────────────────────────────────
  // We pull the accepter join because if the members query somehow
  // misses an accepted invitation (RLS quirk, race condition), we can
  // still render that person as Active using the accepter data.
  const { data: invitationsRaw } = await supabase
    .from("invitations")
    .select(`
      *,
      inviter:profiles!invitations_invited_by_fkey(full_name),
      accepter:profiles!invitations_accepted_by_fkey(id, full_name, slug, avatar_url)
    `)
    .eq("invited_by", profile.id)
    .order("created_at", { ascending: false })

  const invitations = (invitationsRaw ?? []) as unknown as InvitationRow[]

  // ── Merge into a single Person list ────────────────────────────
  // The active member rows come from `profiles`. Invitations that have
  // a matching active profile (accepted) are skipped — that data is
  // already in the member row. Only pending / expired / revoked
  // invitations survive as standalone rows so the admin can see what's
  // outstanding.
  const memberEmails = new Set(members.map((m) => m.email.toLowerCase()))
  const now = new Date()

  const rows: PersonRow[] = [
    ...members.map<PersonRow>((m) => ({
      key:           `p:${m.id}`,
      status:        "active",
      email:         m.email,
      full_name:     m.full_name,
      avatar_url:    m.avatar_url,
      slug:          m.slug,
      role:          m.role,
      inviter_name:  m.inviter?.full_name ?? null,
      date:          m.created_at,
      expires_at:    null,
      profile_id:    m.id,
      invitation_id: null,
      is_self:       m.id === profile.id,
      i_invited:     m.invited_by === profile.id,
    })),
    ...invitations
      .filter((inv) => !memberEmails.has(inv.email.toLowerCase()))
      .map<PersonRow>((inv) => {
        // Accepted invitation without a matching members row → treat
        // as Active and reuse the accepter data. This kicks in when
        // the members query under-returns (e.g. RLS misfire) so the
        // page still renders correctly instead of showing an empty
        // status badge.
        if (inv.status === "accepted") {
          return {
            key:           `i:${inv.id}`,
            status:        "active",
            email:         inv.email,
            full_name:     inv.accepter?.full_name ?? null,
            avatar_url:    inv.accepter?.avatar_url ?? null,
            slug:          inv.accepter?.slug ?? null,
            role:          inv.role,
            inviter_name:  inv.inviter?.full_name ?? null,
            date:          inv.created_at,
            expires_at:    null,
            profile_id:    inv.accepter?.id ?? null,
            invitation_id: inv.id,
            is_self:       false,
            i_invited:     true,
          }
        }
        const expired = inv.status === "pending" && new Date(inv.expires_at) < now
        const effective: PersonRow["status"] = expired
          ? "expired"
          : (inv.status as PersonRow["status"])
        return {
          key:           `i:${inv.id}`,
          status:        effective,
          email:         inv.email,
          full_name:     null,
          avatar_url:    null,
          slug:          null,
          role:          inv.role,
          inviter_name:  inv.inviter?.full_name ?? null,
          date:          inv.created_at,
          expires_at:    inv.expires_at,
          profile_id:    null,
          invitation_id: inv.id,
          is_self:       false,
          i_invited:     true,    // we only fetched invitations.invited_by = me
        }
      }),
  ]

  rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // ── Counts for the stat tiles ──────────────────────────────────
  const counts = {
    active:   rows.filter((r) => r.status === "active").length,
    pending:  rows.filter((r) => r.status === "pending").length,
    inactive: rows.filter((r) => r.status === "expired" || r.status === "revoked").length,
  }

  const roleLabel = (r: string) => {
    if (r === "super_admin") return tInv("roleSuperAdmin")
    if (r === "owner_admin") return tInv("roleAdmin")
    return tInv("roleAgent")
  }
  const statusLabel = (s: PersonRow["status"]) => {
    switch (s) {
      case "active":   return tAgents("statusActive")
      case "pending":  return tInv("statusPending")
      case "expired":  return tInv("statusExpired")
      case "revoked":  return tInv("statusRevoked")
    }
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(dateLocale, {
      day: "2-digit", month: "short", year: "numeric",
    })

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
      <div className="grid grid-cols-3 gap-3">
        <StatTile label={tAgents("statActive")}   number={counts.active} />
        <StatTile label={tAgents("statPending")}  number={counts.pending}  highlight />
        <StatTile label={tAgents("statInactive")} number={counts.inactive} muted />
      </div>

      {/* Personas table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tAgents("tablePerson")}</TableHead>
              <TableHead>{tInv("tableRole")}</TableHead>
              <TableHead>{tAgents("tableStatus")}</TableHead>
              <TableHead>{tAgents("invitedBy")}</TableHead>
              <TableHead>{tAgents("tableDate")}</TableHead>
              <TableHead className="text-right">{tInv("tableActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  {tAgents("empty")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const initials = (r.full_name ?? r.email)
                  .split(" ")
                  .map((n: string) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()

                return (
                  <TableRow key={r.key} className="transition-colors duration-150 ease-out">
                    <TableCell>
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={r.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {r.full_name ?? r.email}
                          </p>
                          {r.full_name && (
                            <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                          )}
                          {r.slug && !r.is_self && (
                            <p className="text-[10px] text-muted-foreground font-numeric truncate">
                              /{r.slug}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {roleLabel(r.role)}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          r.status === "active"  ? "default"
                          : r.status === "pending" ? "secondary"
                          : "outline"
                        }
                        className="text-xs"
                      >
                        {statusLabel(r.status)}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-sm text-muted-foreground">
                      {r.is_self ? "—" : (r.inviter_name ?? "—")}
                    </TableCell>

                    <TableCell className="text-sm text-muted-foreground font-numeric">
                      {fmtDate(r.date)}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Active + invited by me → can unlink. Never on self. */}
                        {r.status === "active" && r.i_invited && !r.is_self && r.profile_id && (
                          <UnlinkAgentButton
                            agentId={r.profile_id}
                            agentName={r.full_name ?? r.email}
                            agentEmail={r.email}
                          />
                        )}
                        {/* Pending invite I sent → can resend / revoke. */}
                        {r.status === "pending" && r.invitation_id && (
                          <>
                            <ResendInvitationButton
                              invitationId={r.invitation_id}
                              email={r.email}
                            />
                            <RevokeInvitationButton
                              invitationId={r.invitation_id}
                              email={r.email}
                            />
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
