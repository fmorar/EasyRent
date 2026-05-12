"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/dashboard" />}
              size="lg"
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Building2 className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <EasyrentLogo className="h-3.5 w-auto text-foreground" />
                <span className="truncate text-xs text-muted-foreground capitalize mt-0.5">
                  {role === "super_admin" ? t("roleSuperAdmin")
                    : role === "owner_admin" ? t("roleAdmin")
                    : t("roleAgent")}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Main nav */}
        <SidebarGroup>
          <SidebarGroupLabel>{t("platformLabel")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_MAIN.map((item) => {
                const label = tNav(item.labelKey as Parameters<typeof tNav>[0])
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActive(item.href)}
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
                  const label = tNav(item.labelKey as Parameters<typeof tNav>[0])
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={isActive(item.href)}
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
