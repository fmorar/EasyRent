import Link from "next/link"
import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getLocale, getTranslations } from "next-intl/server"
import { InviteAgentForm } from "@/components/agent/invite-agent-form"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  ArrowLeftIcon,
  EnvelopeIcon,
  ClockIcon,
} from "@heroicons/react/24/outline"
import type { Invitation } from "@/types"

export default async function InviteAgentPage() {
  const { profile } = await requireAuth()
  const supabase    = await createClient()
  const isAdmin     = profile.role === "owner_admin"
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const t           = await getTranslations("inviteAgentPage")
  const tInv        = await getTranslations("invitations")
  const locale      = await getLocale()
  const dateLocale  = locale === "es" ? "es-CR" : "en-US"

  // Recent invitations sent by the current user
  const { data: invitations } = await supabase
    .from("invitations")
    .select("*")
    .eq("invited_by", profile.id)
    .order("created_at", { ascending: false })
    .limit(10) as { data: Invitation[] | null }

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
    <div className="max-w-3xl mx-auto py-(--spacing-block) px-4 sm:px-6 lg:px-8 space-y-(--spacing-section)">
      <div className="space-y-(--spacing-tight)">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          {t("backToAgents")}
        </Link>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          {t("subtitle")}
        </p>
      </div>

      <InviteAgentForm isAdmin={isAdmin} appUrl={appUrl} />

      {(invitations?.length ?? 0) > 0 && (
        <section className="space-y-(--spacing-cluster)">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("recentInvites")}
          </h2>

          <Card className="divide-y">
            {invitations!.map((inv) => {
              const isExpired = new Date(inv.expires_at) < new Date()
              const status = isExpired && inv.status === "pending" ? "expired" : inv.status
              return (
                <div
                  key={inv.id}
                  className="flex items-center gap-4 px-4 py-3"
                >
                  <span className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <EnvelopeIcon className="h-4 w-4 text-muted-foreground" />
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{inv.email}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{t("roleLabel")} {inv.role === "owner_admin" ? t("roleAdmin") : t("roleAgent")}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 font-numeric">
                        <ClockIcon className="h-3 w-3" />
                        {new Date(inv.created_at).toLocaleDateString(dateLocale, {
                          day:   "2-digit",
                          month: "short",
                          year:  "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  <Badge
                    variant={
                      status === "accepted" ? "default"
                      : status === "pending"  ? "secondary"
                      : "outline"
                    }
                    className="text-xs shrink-0"
                  >
                    {statusLabel(status)}
                  </Badge>
                </div>
              )
            })}
          </Card>
        </section>
      )}
    </div>
  )
}
