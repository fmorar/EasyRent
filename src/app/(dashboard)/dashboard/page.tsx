import Link from "next/link"
import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BuildingOffice2Icon as Building2, ArrowTrendingUpIcon as TrendingUp, UsersIcon as Users, ArrowsRightLeftIcon as Share2, ArrowTopRightOnSquareIcon as ArrowUpRight } from "@heroicons/react/24/outline"

export default async function DashboardPage() {
  const { profile } = await requireAuth()
  const supabase    = await createClient()
  const isAdmin     = profile.role === "owner_admin"

  const [propertiesRes, leadsRes, sharesRes, agentsRes] = await Promise.all([
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),

    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", profile.id)
      .is("deleted_at", null)
      .eq("is_archived", false),

    supabase
      .from("property_shares")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .is("deleted_at", null),

    isAdmin
      ? supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "agent")
          .is("deleted_at", null)
      : Promise.resolve({ count: 0 }),
  ])

  const stats = [
    {
      title:       "Properties",
      value:       propertiesRes.count ?? 0,
      icon:        Building2,
      href:        "/properties",
      description: "Total listings",
      visible:     true,
    },
    {
      title:       "Active Leads",
      value:       leadsRes.count ?? 0,
      icon:        TrendingUp,
      href:        "/leads",
      description: "Assigned to you",
      visible:     true,
    },
    {
      title:       "Pending Shares",
      value:       sharesRes.count ?? 0,
      icon:        Share2,
      href:        "/shares",
      description: "Awaiting review",
      visible:     isAdmin,
    },
    {
      title:       "Agents",
      value:       agentsRes.count ?? 0,
      icon:        Users,
      href:        "/agents",
      description: "Team members",
      visible:     isAdmin,
    },
  ].filter((s) => s.visible)

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {profile.full_name.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground text-sm">
          Here's what's happening with your portfolio today.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Link key={stat.title} href={stat.href}>
              <Card className="hover:shadow-md transition-shadow group">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold font-numeric">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="cursor-pointer hover:bg-muted">
          <Link href="/properties/new" className="flex items-center gap-1.5 text-xs py-0.5">
            <Building2 className="h-3 w-3" />
            Add property
          </Link>
        </Badge>
        <Badge variant="outline" className="cursor-pointer hover:bg-muted">
          <Link href="/leads" className="flex items-center gap-1.5 text-xs py-0.5">
            <TrendingUp className="h-3 w-3" />
            View pipeline
          </Link>
        </Badge>
        {isAdmin && (
          <Badge variant="outline" className="cursor-pointer hover:bg-muted">
            <Link href="/invitations" className="flex items-center gap-1.5 text-xs py-0.5">
              <Users className="h-3 w-3" />
              Invite agent
            </Link>
          </Badge>
        )}
      </div>
    </div>
  )
}
