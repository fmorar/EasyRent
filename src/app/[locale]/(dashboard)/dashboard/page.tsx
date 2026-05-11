import Link from "next/link"
import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getTranslations } from "next-intl/server"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  BuildingOffice2Icon as Building2,
  ArrowTrendingUpIcon as TrendingUp,
  UsersIcon as Users,
  ArrowsRightLeftIcon as Share2,
  ArrowTopRightOnSquareIcon as ArrowUpRight,
  EyeIcon,
  EnvelopeIcon,
  HomeModernIcon,
  NewspaperIcon,
  ChartBarIcon,
  GlobeAltIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  UserPlusIcon,
  CheckBadgeIcon,
  ChartPieIcon,
  StarIcon,
} from "@heroicons/react/24/outline"

export default async function DashboardPage() {
  const { profile } = await requireAuth()
  const supabase    = await createClient()
  const isAdmin     = profile.role === "owner_admin"
  const t           = await getTranslations("dashboard")

  // ── Personal / role-specific counts (everyone) ──────────────────
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

  // ── Public-site metrics (admin only) ─────────────────────────────
  // These describe the HEALTH of the platform: traffic, engagement,
  // pipeline, new captures, visible inventory. We only run the queries
  // when the visitor is admin to keep the dashboard fast for agents.
  const since7d  = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000).toISOString()
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    publicListingsRes, propertyViews7dRes, newsletterRes,
    ownerLeadsNewRes, blogPostsRes, reports7dRes,
    propertyViews30dRes, whatsapp7dRes,
    newLeads7dRes, closedLeads30dRes, topPropertyRowsRes,
  ] = isAdmin
    ? await Promise.all([
        supabase
          .from("properties")
          .select("id", { count: "exact", head: true })
          .eq("is_marketplace_visible", true)
          .is("deleted_at", null),

        supabase
          .from("property_analytics_events")
          .select("id", { count: "exact", head: true })
          .in("event_type", ["property_viewed", "property_unique_viewed"])
          .gte("created_at", since7d),

        supabase
          .from("newsletter_subscribers")
          .select("id", { count: "exact", head: true })
          .is("unsubscribed_at", null),

        supabase
          .from("owner_leads")
          .select("id", { count: "exact", head: true })
          .eq("status", "new")
          .is("deleted_at", null),

        supabase
          .from("blog_posts")
          .select("id", { count: "exact", head: true })
          .eq("status", "published")
          .is("deleted_at", null),

        supabase
          .from("market_reports")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since7d),

        // ── New: 30-day views (trend vs the 7d card) ──────────
        supabase
          .from("property_analytics_events")
          .select("id", { count: "exact", head: true })
          .in("event_type", ["property_viewed", "property_unique_viewed"])
          .gte("created_at", since30d),

        // ── New: WhatsApp clicks 7d (high-intent action) ──────
        supabase
          .from("property_analytics_events")
          .select("id", { count: "exact", head: true })
          .eq("event_type", "whatsapp_clicked")
          .gte("created_at", since7d),

        // ── New: pipeline velocity ────────────────────────────
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since7d)
          .is("deleted_at", null),

        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("stage", "closed")
          .gte("updated_at", since30d)
          .is("deleted_at", null),

        // ── New: top-viewed property in last 7d.
        // PostgREST doesn't expose GROUP BY in the query builder, so
        // we fetch a capped list of `property_id`s from view events
        // and roll them up in JS. 2000 rows is plenty — the result
        // tells us THE top one, not a full leaderboard.
        supabase
          .from("property_analytics_events")
          .select("property_id")
          .eq("event_type", "property_viewed")
          .gte("created_at", since7d)
          .limit(2000),
      ])
    : [
        { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 },
        { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 },
        { data: [] as Array<{ property_id: string }> },
      ]

  // ── Derived: top-viewed property (id + title + view count) ─────
  let topProperty: { title: string; slug: string; views: number } | null = null
  if (isAdmin) {
    const rows = (topPropertyRowsRes as { data: Array<{ property_id: string }> | null }).data ?? []
    const counts: Record<string, number> = {}
    for (const r of rows) {
      if (!r.property_id) continue
      counts[r.property_id] = (counts[r.property_id] ?? 0) + 1
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    if (top) {
      const [topId, topViews] = top
      const { data: prop } = await supabase
        .from("properties")
        .select("title, slug")
        .eq("id", topId)
        .is("deleted_at", null)
        .maybeSingle()
      if (prop?.title && prop?.slug) {
        topProperty = { title: prop.title, slug: prop.slug, views: topViews }
      }
    }
  }

  // ── Derived: conversion rate (leads created / views) over 7d. ──
  // Percentage of property views that turned into a captured lead.
  // We cap at 999% defensively for the edge case where there are way
  // more leads than views (e.g. leads coming from external channels).
  const conversionRate = (() => {
    const views = propertyViews7dRes.count ?? 0
    const leads = newLeads7dRes.count    ?? 0
    if (views === 0) return null
    return Math.min(999, Math.round((leads / views) * 1000) / 10)  // 1 decimal
  })()

  // Hero metric (the one most relevant to today's work) + a denser
  // secondary stack. We deliberately AVOID the identical 4-card grid:
  // hierarchy is communicated through size, weight, and grouping, not
  // by repeating the same tile shape four times.
  const heroStat = isAdmin
    ? {
        title:       t("properties"),
        value:       propertiesRes.count ?? 0,
        icon:        Building2,
        href:        "/properties",
        description: t("totalListings"),
      }
    : {
        title:       t("activeLeads"),
        value:       leadsRes.count ?? 0,
        icon:        TrendingUp,
        href:        "/leads",
        description: t("assignedToYou"),
      }

  type SecondaryStat = {
    title: string
    value: number
    icon:  typeof Building2
    href:  string
  }

  const rawSecondary: Array<SecondaryStat | null> = [
    isAdmin
      ? { title: t("activeLeads"),    value: leadsRes.count      ?? 0, icon: TrendingUp, href: "/leads" }
      : { title: t("properties"),     value: propertiesRes.count ?? 0, icon: Building2,  href: "/properties" },
    isAdmin
      ? { title: t("pendingShares"),  value: sharesRes.count     ?? 0, icon: Share2,     href: "/shares" }
      : null,
    isAdmin
      ? { title: t("agents"),         value: agentsRes.count     ?? 0, icon: Users,      href: "/agents" }
      : null,
  ]

  const secondaryStats: SecondaryStat[] = rawSecondary.filter(
    (x): x is SecondaryStat => x !== null,
  )

  return (
    <div className="space-y-(--spacing-section)">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
          {t("welcome")}, {profile.full_name.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">{t("portfolioToday")}</p>
      </header>

      {/* ── Hero (1 metric) + secondary list (1-3 metrics) ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-(--spacing-cluster)">
        <Link href={heroStat.href} className="group">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardContent className="flex flex-col justify-between gap-6 py-6 sm:py-8 min-h-[180px]">
              <div className="flex items-start justify-between gap-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {heroStat.title}
                </p>
                <heroStat.icon className="h-5 w-5 text-muted-foreground/70" />
              </div>
              <div className="space-y-1.5">
                <p className="font-numeric tabular-nums font-bold leading-none text-5xl sm:text-6xl">
                  {heroStat.value}
                </p>
                <p className="text-sm text-muted-foreground">
                  {heroStat.description}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        {secondaryStats.length > 0 && (
          <Card className="h-full">
            <CardContent className="divide-y divide-border px-0 py-0">
              {secondaryStats.map((stat) => {
                const Icon = stat.icon
                return (
                  <Link
                    key={stat.title}
                    href={stat.href}
                    className="group flex items-center justify-between gap-4 px-4 py-4 sm:px-5 sm:py-5 hover:bg-muted/40 transition-colors"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                      <span className="text-sm font-medium truncate">
                        {stat.title}
                      </span>
                    </span>
                    <span className="flex items-baseline gap-2 shrink-0">
                      <span className="font-numeric tabular-nums font-semibold text-2xl leading-none">
                        {stat.value}
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                  </Link>
                )
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Site metrics — admin only ────────────────────────────────
              Surface the health of the PUBLIC platform: traffic in the
              last 7 days, new captures, marketplace inventory, blog
              and report output. Each tile links to the relevant
              admin page so the admin can drill in fast.
      */}
      {isAdmin && (
        <section className="space-y-(--spacing-cluster)">
          <header className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="text-base font-heading font-semibold">
              {t("siteMetricsTitle")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("siteMetricsSubtitle")}
            </p>
          </header>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-(--spacing-cluster)">
            <MetricTile
              icon={<EyeIcon className="h-4 w-4" />}
              label={t("metricViews7d")}
              value={propertyViews7dRes.count ?? 0}
              hint={t("metricViews7dHint")}
              href="/properties"
            />
            <MetricTile
              icon={<GlobeAltIcon className="h-4 w-4" />}
              label={t("metricPublicListings")}
              value={publicListingsRes.count ?? 0}
              hint={t("metricPublicListingsHint")}
              href="/properties"
            />
            <MetricTile
              icon={<HomeModernIcon className="h-4 w-4" />}
              label={t("metricOwnerLeads")}
              value={ownerLeadsNewRes.count ?? 0}
              hint={t("metricOwnerLeadsHint")}
              href="/leads"
            />
            <MetricTile
              icon={<EnvelopeIcon className="h-4 w-4" />}
              label={t("metricNewsletter")}
              value={newsletterRes.count ?? 0}
              hint={t("metricNewsletterHint")}
              href="/leads"
            />
            <MetricTile
              icon={<NewspaperIcon className="h-4 w-4" />}
              label={t("metricBlogPosts")}
              value={blogPostsRes.count ?? 0}
              hint={t("metricBlogPostsHint")}
              href="/dashboard/blog"
            />
            <MetricTile
              icon={<ChartBarIcon className="h-4 w-4" />}
              label={t("metricReports7d")}
              value={reports7dRes.count ?? 0}
              hint={t("metricReports7dHint")}
              href="/market-analysis"
            />

            {/* ── Row 2 — engagement + pipeline + qualitative ─────── */}
            <MetricTile
              icon={<CalendarDaysIcon className="h-4 w-4" />}
              label={t("metricViews30d")}
              value={propertyViews30dRes.count ?? 0}
              hint={t("metricViews30dHint")}
              href="/properties"
            />
            <MetricTile
              icon={<ChatBubbleLeftRightIcon className="h-4 w-4" />}
              label={t("metricWhatsapp7d")}
              value={whatsapp7dRes.count ?? 0}
              hint={t("metricWhatsapp7dHint")}
              href="/leads"
            />
            <MetricTile
              icon={<UserPlusIcon className="h-4 w-4" />}
              label={t("metricNewLeads7d")}
              value={newLeads7dRes.count ?? 0}
              hint={t("metricNewLeads7dHint")}
              href="/leads"
            />
            <MetricTile
              icon={<CheckBadgeIcon className="h-4 w-4" />}
              label={t("metricClosedLeads30d")}
              value={closedLeads30dRes.count ?? 0}
              hint={t("metricClosedLeads30dHint")}
              href="/leads"
            />
            <MetricTile
              icon={<ChartPieIcon className="h-4 w-4" />}
              label={t("metricConversion")}
              // Percentage; falls back to "—" when the denominator is 0.
              valueText={conversionRate != null ? `${conversionRate}%` : "—"}
              hint={t("metricConversionHint")}
            />
            {/* Top property — qualitative tile. Whole row becomes
                clickable to the property's slug if we found one. */}
            <MetricTile
              icon={<StarIcon className="h-4 w-4" />}
              label={t("metricTopProperty")}
              valueText={
                topProperty
                  ? topProperty.title.length > 28
                    ? `${topProperty.title.slice(0, 27)}…`
                    : topProperty.title
                  : "—"
              }
              valueSize="sm"
              hint={
                topProperty
                  ? t("metricTopPropertyHint", { views: topProperty.views })
                  : t("metricTopPropertyEmpty")
              }
              href={topProperty ? `/p/${topProperty.slug}` : undefined}
            />
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="cursor-pointer hover:bg-muted">
          <Link href="/properties/new" className="flex items-center gap-1.5 text-xs py-0.5">
            <Building2 className="h-3 w-3" />
            {t("addProperty")}
          </Link>
        </Badge>
        <Badge variant="outline" className="cursor-pointer hover:bg-muted">
          <Link href="/leads" className="flex items-center gap-1.5 text-xs py-0.5">
            <TrendingUp className="h-3 w-3" />
            {t("viewPipeline")}
          </Link>
        </Badge>
        {isAdmin && (
          <Badge variant="outline" className="cursor-pointer hover:bg-muted">
            <Link href="/invitations" className="flex items-center gap-1.5 text-xs py-0.5">
              <Users className="h-3 w-3" />
              {t("inviteAgent")}
            </Link>
          </Badge>
        )}
      </div>
    </div>
  )
}

// ── MetricTile ─────────────────────────────────────────────────────
/**
 * Compact metric tile for the dashboard's "Métricas del sitio" grid.
 * Visual: small icon + label up top, big number, tiny hint underneath.
 * Whole tile is clickable and routes to the relevant detail page.
 *
 * Supports two value shapes:
 *   • `value` (number) — formatted with `toLocaleString` and rendered
 *     in the tabular-numerics font for that classic dashboard feel.
 *   • `valueText` (string) — for qualitative tiles like percentages
 *     ("3.2%") or property names. Pass `valueSize="sm"` when the text
 *     is long (e.g. a listing title) so it doesn't overflow the tile.
 */
function MetricTile({
  icon, label, value, valueText, valueSize = "lg", hint, href,
}: {
  icon:       React.ReactNode
  label:      string
  value?:     number
  valueText?: string
  valueSize?: "lg" | "sm"
  hint?:      string
  href?:      string
}) {
  // Numeric → tabular-nums + en-US grouping. String → as-is.
  const display = value != null ? value.toLocaleString("en-US") : valueText ?? "—"
  const sizeCls = valueSize === "sm"
    ? "text-sm sm:text-base leading-snug line-clamp-2"
    : "text-2xl sm:text-3xl leading-none"
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2 text-muted-foreground">
        <span className="text-[10px] uppercase tracking-[0.18em] font-medium">{label}</span>
        <span className="text-muted-foreground/70">{icon}</span>
      </div>
      <p
        className={
          "font-numeric tabular-nums font-bold mt-2 " +
          sizeCls
        }
      >
        {display}
      </p>
      {hint && (
        <p className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-2">{hint}</p>
      )}
    </>
  )
  if (href) {
    return (
      <Link
        href={href}
        className="group rounded-xl border bg-card px-4 py-4 transition-colors hover:bg-muted/40 hover:shadow-sm"
      >
        {inner}
      </Link>
    )
  }
  return (
    <div className="rounded-xl border bg-card px-4 py-4">
      {inner}
    </div>
  )
}
