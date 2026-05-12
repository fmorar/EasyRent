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
  InboxArrowDownIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline"

export default async function DashboardPage() {
  const { profile } = await requireAuth()
  const supabase    = await createClient()
  const isAdmin     = profile.role === "owner_admin"
  const t           = await getTranslations("dashboard")

  // ── Per-user property scope ──────────────────────────────────────
  // Build the list of property IDs the user can see in their dashboard:
  // ones they created + ones approved-shared to them. We resolve this
  // once so every analytics tile below can filter consistently and the
  // numbers stay coherent across cards.
  const [myPropertiesRowsRes, sharesInRowsRes, sharesOutRowsRes] = await Promise.all([
    supabase
      .from("properties")
      .select("id")
      .eq("created_by", profile.id)
      .is("deleted_at", null),

    // Shares where I'm the recipient, in any non-deleted state. We split
    // them by status below to count "pending" vs "approved".
    supabase
      .from("property_shares")
      .select("property_id, status")
      .eq("shared_with", profile.id)
      .is("deleted_at", null),

    // Shares I sent out — listings of mine I distributed to other agents.
    // We count the distinct properties shared (not raw rows) so a property
    // shared to 3 agents still counts as 1 piece of inventory put out.
    supabase
      .from("property_shares")
      .select("property_id, status")
      .eq("shared_by", profile.id)
      .is("deleted_at", null),
  ])

  const myPropertyIds = (myPropertiesRowsRes.data ?? []).map((r) => r.id)

  const sharesInRows = sharesInRowsRes.data ?? []
  const approvedInIds  = sharesInRows
    .filter((r) => r.status === "approved")
    .map((r) => r.property_id)
  const pendingInCount = sharesInRows.filter((r) => r.status === "pending").length

  // Distinct property_ids I shared out (any status).
  const sharesOutRows = sharesOutRowsRes.data ?? []
  const sharedOutCount = new Set(sharesOutRows.map((r) => r.property_id)).size

  // Full scope: anything I can act on as MY portfolio in the dashboard.
  const scopeIds = Array.from(new Set([...myPropertyIds, ...approvedInIds]))

  // Convenience for PostgREST .in() — when the array is empty, queries
  // with .in("…", []) match nothing, which is the correct behavior.
  const scopeFilter = scopeIds.length > 0 ? scopeIds : ["00000000-0000-0000-0000-000000000000"]

  // ── Personal counts (everyone) ───────────────────────────────────
  const [leadsRes, ownPublicRes] = await Promise.all([
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", profile.id)
      .is("deleted_at", null)
      .eq("is_archived", false),

    // Public marketplace count restricted to MY listings only.
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("created_by", profile.id)
      .eq("is_marketplace_visible", true)
      .is("deleted_at", null),
  ])

  const since7d  = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000).toISOString()
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // ── Per-user analytics: views / whatsapp / leads on my scope ─────
  // Filtered by the user's scoped property IDs so the numbers reflect
  // their own portfolio rather than the whole platform.
  const [
    views7dRes, views30dRes, whatsapp7dRes,
    newLeads7dRes, closedLeads30dRes, topPropertyRowsRes,
  ] = await Promise.all([
    supabase
      .from("property_analytics_events")
      .select("id", { count: "exact", head: true })
      .in("event_type", ["property_viewed", "property_unique_viewed"])
      .in("property_id", scopeFilter)
      .gte("created_at", since7d),

    supabase
      .from("property_analytics_events")
      .select("id", { count: "exact", head: true })
      .in("event_type", ["property_viewed", "property_unique_viewed"])
      .in("property_id", scopeFilter)
      .gte("created_at", since30d),

    supabase
      .from("property_analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "whatsapp_clicked")
      .in("property_id", scopeFilter)
      .gte("created_at", since7d),

    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", profile.id)
      .gte("created_at", since7d)
      .is("deleted_at", null),

    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", profile.id)
      .eq("stage", "closed")
      .gte("updated_at", since30d)
      .is("deleted_at", null),

    // Roll up the top-viewed property of mine in the last 7 days. We
    // pull a capped page of property_id events and tally in JS because
    // PostgREST doesn't expose GROUP BY.
    supabase
      .from("property_analytics_events")
      .select("property_id")
      .eq("event_type", "property_viewed")
      .in("property_id", scopeFilter)
      .gte("created_at", since7d)
      .limit(2000),
  ])

  // ── Top-viewed property of mine (id + title + view count) ────────
  let topProperty: { title: string; slug: string; views: number } | null = null
  {
    const rows = topPropertyRowsRes.data ?? []
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

  // Conversion: leads created / property views in last 7d (this user's scope)
  const conversionRate = (() => {
    const views = views7dRes.count ?? 0
    const leads = newLeads7dRes.count ?? 0
    if (views === 0) return null
    return Math.min(999, Math.round((leads / views) * 1000) / 10)
  })()

  // ── Admin-only platform metrics ──────────────────────────────────
  // Things that describe the PLATFORM, not any single user: newsletter
  // subscribers, owner leads (incoming property submissions), blog
  // posts, market reports run. Only admins see these.
  const [
    newsletterRes, ownerLeadsNewRes, blogPostsRes, reports7dRes, totalAgentsRes,
  ] = isAdmin
    ? await Promise.all([
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

        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "agent")
          .is("deleted_at", null),
      ])
    : [
        { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 },
      ]

  const myListingsTotal = myPropertyIds.length + approvedInIds.length

  return (
    <div className="space-y-(--spacing-section)">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
          {t("welcome")}, {profile.full_name.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">{t("portfolioToday")}</p>
      </header>

      {/* ── Hero: portfolio breakdown (3 numbers) + secondary list ──
              The hero now answers "what's in your portfolio?" with three
              concrete cuts: things you uploaded, things shared TO you,
              and things you shared OUT. Replaces the old "total listings"
              tile which was misleading once non-admins were properly
              scoped to their own data. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-(--spacing-cluster)">
        <Card className="h-full">
          <CardContent className="py-6 sm:py-8 space-y-(--spacing-block)">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {t("portfolioTitle")}
                </p>
                <p className="font-numeric tabular-nums font-bold text-5xl sm:text-6xl leading-none mt-2">
                  {myListingsTotal}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("portfolioTotalHint")}
                </p>
              </div>
              <Building2 className="h-5 w-5 text-muted-foreground/70" />
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-(--spacing-tight) border-t">
              <PortfolioStat
                href="/properties"
                icon={<Building2 className="h-3.5 w-3.5" />}
                label={t("portfolioMine")}
                value={myPropertyIds.length}
                hint={t("portfolioMineHint")}
              />
              <PortfolioStat
                href="/properties"
                icon={<InboxArrowDownIcon className="h-3.5 w-3.5" />}
                label={t("portfolioReceived")}
                value={approvedInIds.length}
                hint={t("portfolioReceivedHint")}
              />
              <PortfolioStat
                href="/properties"
                icon={<PaperAirplaneIcon className="h-3.5 w-3.5" />}
                label={t("portfolioGiven")}
                value={sharedOutCount}
                hint={t("portfolioGivenHint")}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardContent className="divide-y divide-border px-0 py-0">
            <SecondaryRow
              href="/leads"
              icon={<TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground/70" />}
              label={t("activeLeads")}
              value={leadsRes.count ?? 0}
            />
            <SecondaryRow
              href="/shares"
              icon={<Share2 className="h-4 w-4 shrink-0 text-muted-foreground/70" />}
              label={t("pendingShares")}
              value={pendingInCount}
            />
            {isAdmin && (
              <SecondaryRow
                href="/agents"
                icon={<Users className="h-4 w-4 shrink-0 text-muted-foreground/70" />}
                label={t("agents")}
                value={totalAgentsRes.count ?? 0}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── My performance (everyone) ───────────────────────────────
              All tiles below are filtered by the user's own property
              scope (mine + approved-shared-in). Replaces the previous
              admin-only metrics grid so every agent can see how THEIR
              listings are performing. */}
      <section className="space-y-(--spacing-cluster)">
        <header className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="text-base font-heading font-semibold">
            {t("myMetricsTitle")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("myMetricsSubtitle")}
          </p>
        </header>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-(--spacing-cluster)">
          <MetricTile
            icon={<EyeIcon className="h-4 w-4" />}
            label={t("metricViews7d")}
            value={views7dRes.count ?? 0}
            hint={t("metricViews7dHint")}
            href="/properties"
          />
          <MetricTile
            icon={<CalendarDaysIcon className="h-4 w-4" />}
            label={t("metricViews30d")}
            value={views30dRes.count ?? 0}
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
            valueText={conversionRate != null ? `${conversionRate}%` : "—"}
            hint={t("metricConversionHint")}
          />
          <MetricTile
            icon={<GlobeAltIcon className="h-4 w-4" />}
            label={t("metricMyPublic")}
            value={ownPublicRes.count ?? 0}
            hint={t("metricMyPublicHint")}
            href="/properties"
          />
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

      {/* ── Platform-level metrics (admin only) ─────────────────────
              These are inherently global (newsletter list, owner leads,
              blog, market reports) so they're not scopable per-user.
              Stays admin-only. */}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-(--spacing-cluster)">
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

// ── PortfolioStat ──────────────────────────────────────────────────
function PortfolioStat({
  href, icon, label, value, hint,
}: {
  href:  string
  icon:  React.ReactNode
  label: string
  value: number
  hint:  string
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg px-2 py-2 sm:px-3 sm:py-3 hover:bg-muted/40 transition-colors"
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span className="text-muted-foreground/70">{icon}</span>
        <span className="text-[10px] uppercase tracking-[0.16em] font-medium truncate">
          {label}
        </span>
      </div>
      <p className="font-numeric tabular-nums font-bold text-2xl sm:text-3xl mt-1.5 leading-none">
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-2">
        {hint}
      </p>
    </Link>
  )
}

// ── SecondaryRow ───────────────────────────────────────────────────
function SecondaryRow({
  href, icon, label, value,
}: {
  href:  string
  icon:  React.ReactNode
  label: string
  value: number
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-4 px-4 py-4 sm:px-5 sm:py-5 hover:bg-muted/40 transition-colors"
    >
      <span className="flex items-center gap-3 min-w-0">
        {icon}
        <span className="text-sm font-medium truncate">{label}</span>
      </span>
      <span className="flex items-baseline gap-2 shrink-0">
        <span className="font-numeric tabular-nums font-semibold text-2xl leading-none">
          {value}
        </span>
        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity" />
      </span>
    </Link>
  )
}

// ── MetricTile ─────────────────────────────────────────────────────
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
