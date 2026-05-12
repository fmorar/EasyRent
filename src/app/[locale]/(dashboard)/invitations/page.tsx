import Link from "next/link"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getLocale, getTranslations } from "next-intl/server"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { UserPlusIcon } from "@heroicons/react/24/outline"
import { RevokeInvitationButton } from "@/components/agent/revoke-invitation-button"
import { ResendInvitationButton } from "@/components/agent/resend-invitation-button"
import { StatTile } from "@/components/shared/stat-tile"
import type { Invitation } from "@/types"

type InvitationRow = Invitation & {
  inviter:  { full_name: string } | null
  accepter: { full_name: string } | null
}

export default async function InvitationsPage() {
  await requireAdmin()
  const supabase = await createClient()
  const t        = await getTranslations("invitations")
  const locale   = await getLocale()
  const dateLocale = locale === "es" ? "es-CR" : "en-US"

  // Pull every invitation, joined with inviter + (optional) accepter profiles
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
    pending:  rows.filter((r) => r.effectiveStatus === "pending").length,
    accepted: rows.filter((r) => r.effectiveStatus === "accepted").length,
    expired:  rows.filter((r) => r.effectiveStatus === "expired").length,
    revoked:  rows.filter((r) => r.effectiveStatus === "revoked").length,
  }

  const statusLabel = (s: string) => {
    switch (s) {
      case "pending":  return t("statusPending")
      case "accepted": return t("statusAccepted")
      case "expired":  return t("statusExpired")
      case "revoked":  return t("statusRevoked")
      default:         return s
    }
  }

  return (
    <div className="space-y-(--spacing-section)">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("subtitle")}
          </p>
        </div>
        <Link href="/agents/invite" className={buttonVariants()}>
          <UserPlusIcon className="h-4 w-4 mr-2" />
          {t("newInvite")}
        </Link>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label={t("pending")}  number={counts.pending}  highlight />
        <StatTile label={t("accepted")} number={counts.accepted} />
        <StatTile label={t("expired")}  number={counts.expired}  muted />
        <StatTile label={t("revoked")}  number={counts.revoked}  muted />
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("tableEmail")}</TableHead>
              <TableHead>{t("tableRole")}</TableHead>
              <TableHead>{t("tableInvitedBy")}</TableHead>
              <TableHead>{t("tableStatus")}</TableHead>
              <TableHead>{t("tableSent")}</TableHead>
              <TableHead>{t("tableExpires")}</TableHead>
              <TableHead className="text-right">{t("tableActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((inv) => (
                <TableRow key={inv.id} className="transition-colors duration-150 ease-out">
                  <TableCell className="font-medium text-sm">{inv.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {inv.role === "owner_admin" ? t("roleAdmin") : t("roleAgent")}
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
    </div>
  )
}
