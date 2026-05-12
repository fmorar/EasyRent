"use client"

import Link from "next/link"
// next-intl's usePathname strips the locale prefix, so `pathname` here
// is "/dashboard" not "/es/dashboard" — that's what the NAV items
// compare against, otherwise the active rail never matches.
import { usePathname, useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import {
  Squares2X2Icon as LayoutDashboard,
  BuildingOffice2Icon as Building2,
  FolderOpenIcon as FolderOpen,
  UsersIcon as Users,
  DocumentTextIcon as FileText,
  Cog6ToothIcon as Settings,
  ArrowsRightLeftIcon as Share2,
  ArrowTrendingUpIcon as TrendingUp,
  ChartBarIcon as BarChart,
  PresentationChartLineIcon as ChartLine,
  ArrowRightOnRectangleIcon as LogOut,
  UserIcon as User,
  ChevronUpDownIcon as ChevronsUpDown,
  NewspaperIcon as NewsIcon,
  MagnifyingGlassIcon as SearchIcon,
} from "@heroicons/react/24/outline"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from "@/components/ui/sidebar"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { EasyrentLogo } from "@/components/shared/easyrent-logo"
import { createClient } from "@/lib/supabase/client"
import { isAdminRole } from "@/lib/roles"
import type { UserRole } from "@/types"

interface NavItem {
  href:      string
  /** Translation key under `sidebar.nav.*`. */
  labelKey:   string
  icon:       React.ElementType
  adminOnly:  boolean
  /** Render a small "Pronto" badge — feature ships later. */
  comingSoon?: boolean
}

const NAV_MAIN: NavItem[] = [
  { href: "/dashboard",  labelKey: "dashboard",  icon: LayoutDashboard, adminOnly: false },
  { href: "/properties", labelKey: "properties", icon: Building2,       adminOnly: false },
  { href: "/projects",   labelKey: "projects",   icon: FolderOpen,      adminOnly: false },
  { href: "/leads",      labelKey: "leads",      icon: TrendingUp,      adminOnly: false, comingSoon: true },
  { href: "/contracts",  labelKey: "contracts",  icon: FileText,        adminOnly: false },
  { href: "/market-analysis", labelKey: "marketAnalysis", icon: BarChart, adminOnly: false },
  { href: "/performance-reports", labelKey: "performanceReports", icon: ChartLine, adminOnly: false },
  // /agents is also the surface where every user (agent / admin / super)
  // invites peers — so it lives in the main nav, not gated to admins.
  // The page scopes its tables to the viewer.
  { href: "/agents",     labelKey: "agents",      icon: Users,          adminOnly: false },
]

const NAV_ADMIN: NavItem[] = [
  { href: "/owner-prospector", labelKey: "ownerProspector", icon: SearchIcon, adminOnly: true },
  { href: "/shares",      labelKey: "shareRequests", icon: Share2,  adminOnly: true },
  // Blog is editorial — only the platform admins (owner_admin +
  // super_admin) curate it. Agents don't see the menu item.
  { href: "/dashboard/blog", labelKey: "blog",  icon: NewsIcon,    adminOnly: true },
]

// Settings used to live as a standalone entry at the bottom of the
// nav, but it duplicated the "Configuración" item already inside the
// user dropdown in the SidebarFooter — same destination, same icon,
// shown twice. We keep the dropdown one (next to the avatar, where
// users expect "edit profile / settings / sign out" to live) and
// drop the standalone group.

interface AppSidebarProps {
  role:      UserRole
  fullName:  string
  email:     string
  slug:      string
  avatarUrl: string | null
}

export function AppSidebar({ role, fullName, email, slug, avatarUrl }: AppSidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const isAdmin  = isAdminRole(role)
  const t        = useTranslations("sidebar")
  const tNav     = useTranslations("sidebar.nav")

  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname === href || pathname.startsWith(href + "/")
  }

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        {/* Brand lockup: icon · wordmark · role label.
            Not wrapped in SidebarMenuButton on purpose — that wrapper
            applies `[&_svg]:size-4` which shrinks every nested SVG to
            16px, and the Tailwind `!` postfix doesn't cleanly outrank
            its cascade. Using a plain Link sidesteps the rule. */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-sidebar-accent transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <svg
            viewBox="0 0 64 64"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            aria-hidden
            className="size-8 shrink-0 text-foreground"
          >
            <circle cx="22" cy="24" r="7" fill="currentColor" />
            <circle cx="42" cy="24" r="7" fill="currentColor" />
            <path
              d="M14 36 Q32 56 50 36"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
            />
          </svg>
          <div className="flex-1 min-w-0 flex flex-col items-start justify-center gap-0.5 group-data-[collapsible=icon]:hidden">
            {/* Wordmark — h-5 keeps it visually balanced against the
                32px smiley without overpowering it. The svg's intrinsic
                aspect ratio (~4:1) makes it ~80px wide at this height. */}
            <EasyrentLogo className="h-5 w-auto text-foreground block" />
            {/* Role tag — small caps so it reads as a label, not a name. */}
            <span className="block text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground truncate">
              {role === "super_admin" ? t("roleSuperAdmin")
                : role === "owner_admin" ? t("roleAdmin")
                : t("roleAgent")}
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {/* Main nav */}
        <SidebarGroup>
          <SidebarGroupLabel>{t("platformLabel")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_MAIN.map((item) => {
                const label  = tNav(item.labelKey as Parameters<typeof tNav>[0])
                const active = isActive(item.href)
                return (
                  <SidebarMenuItem key={item.href} className="relative">
                    {/* Active indicator — primary-coloured rail anchored
                        to the item's left edge so the user always knows
                        which page they're on. Hidden when sidebar is
                        collapsed to icon-only mode (group-data check). */}
                    {active && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-primary group-data-[collapsible=icon]:hidden"
                      />
                    )}
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={active}
                      tooltip={label}
                    >
                      <item.icon />
                      <span className="flex-1">{label}</span>
                      {item.comingSoon && (
                        <span className="text-[9px] uppercase tracking-[0.12em] font-medium text-muted-foreground border border-border rounded-full px-1.5 py-0.5 leading-none">
                          Pronto
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin nav */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>{t("managementLabel")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ADMIN.map((item) => {
                  const label  = tNav(item.labelKey as Parameters<typeof tNav>[0])
                  const active = isActive(item.href)
                  return (
                    <SidebarMenuItem key={item.href} className="relative">
                      {active && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-primary group-data-[collapsible=icon]:hidden"
                        />
                      )}
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={active}
                        tooltip={label}
                      >
                        <item.icon />
                        <span>{label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Settings is reachable via the user dropdown in the footer
            below — see the "Configuración" item next to the avatar.
            Keeping it in two places confused users about which surface
            owned profile/preferences. */}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  />
                }
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={avatarUrl ?? undefined} alt={fullName} />
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{fullName}</span>
                  <span className="truncate text-xs text-muted-foreground">{email}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal truncate p-0 px-2 py-1.5">
                    {email}
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => window.open(`/agents/${slug}`, "_blank", "noopener,noreferrer")}>
                  <User className="mr-2 h-4 w-4" />
                  {t("publicProfile")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  {tNav("settings")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
