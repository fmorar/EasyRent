import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { UserPlusIcon as UserPlus } from "@heroicons/react/24/outline"
import type { Profile, Invitation } from "@/types"

type AgentRow = Profile & { inviter: { full_name: string } | null }

export default async function AgentsPage() {
  await requireAdmin()
  const supabase = await createClient()
  const t        = await getTranslations("agents")

  const { data: agentsRaw } = await supabase
    .from("profiles")
    .select(`
      *,
      inviter:profiles!profiles_invited_by_fkey(full_name)
    `)
    .eq("role", "agent")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  const agents = agentsRaw as AgentRow[] | null

  const { data: pendingInvitations } = await supabase
    .from("invitations")
    .select("*")
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false }) as { data: Invitation[] | null }

  return (
    <div className="space-y-(--spacing-section)">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        <Link href="/agents/invite" className={buttonVariants()}>
          <UserPlus className="h-4 w-4 mr-2" />
          {t("invite")}
        </Link>
      </div>

      {/* Active agents */}
      <section className="space-y-(--spacing-cluster)">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("active")} ({agents?.length ?? 0})
        </h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tableAgent")}</TableHead>
                <TableHead>{t("tableEmail")}</TableHead>
                <TableHead>{t("tableStatus")}</TableHead>
                <TableHead>{t("invitedBy")}</TableHead>
                <TableHead>{t("joined")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!agents?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {t("noAgents")}
                  </TableCell>
                </TableRow>
              ) : (
                agents.map((agent) => {
                  const initials = agent.full_name
                    .split(" ")
                    .map((n: string) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()

                  return (
                    <TableRow key={agent.id} className="transition-colors duration-150 ease-out">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={agent.avatar_url ?? undefined} />
                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{agent.full_name}</p>
                            <p className="text-xs text-muted-foreground">/{agent.slug}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{agent.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant={agent.status === "active" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {agent.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {agent.inviter?.full_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(agent.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </section>

      {/* Pending invitations */}
      {(pendingInvitations?.length ?? 0) > 0 && (
        <section className="space-y-(--spacing-cluster)">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("pendingInvitations")} ({pendingInvitations!.length})
          </h2>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("tableEmail")}</TableHead>
                  <TableHead>{t("tableRole")}</TableHead>
                  <TableHead>{t("tableExpires")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations!.map((inv) => (
                  <TableRow key={inv.id} className="transition-colors duration-150 ease-out">
                    <TableCell className="text-sm">{inv.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{inv.role}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(inv.expires_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </section>
      )}
    </div>
  )
}
