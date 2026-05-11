"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { EasyrentLogo } from "@/components/shared/easyrent-logo"
import {
  Squares2X2Icon as LayoutDashboard,
  BuildingOffice2Icon as Building2,
  FolderOpenIcon as FolderOpen,
  UsersIcon as Users,
  DocumentTextIcon as FileText,
  Cog6ToothIcon as Settings,
  UserPlusIcon as UserPlus,
  ArrowsRightLeftIcon as Share2,
  ArrowTrendingUpIcon as TrendingUp,
} from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/types"

interface NavItem {
  href:      string
  label:     string
  icon:      React.ElementType
  adminOnly: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",   label: "Dashboard",       icon: LayoutDashboard, adminOnly: false },
  { href: "/properties",  label: "Properties",      icon: Building2,       adminOnly: false },
  { href: "/projects",    label: "Projects",         icon: FolderOpen,      adminOnly: false },
  { href: "/leads",       label: "Leads",            icon: TrendingUp,      adminOnly: false },
  { href: "/contracts",   label: "Contracts",        icon: FileText,        adminOnly: false },
  { href: "/agents",      label: "Agents",           icon: Users,           adminOnly: true  },
  { href: "/invitations", label: "Invitations",      icon: UserPlus,        adminOnly: true  },
  { href: "/shares",      label: "Pending Shares",   icon: Share2,          adminOnly: true  },
  { href: "/settings",    label: "Settings",         icon: Settings,        adminOnly: false },
]

interface SidebarProps {
  role: UserRole
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || role === "owner_admin"
  )

  return (
    <aside className="hidden lg:flex flex-col w-60 border-r bg-sidebar min-h-screen">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b">
        <Link href="/dashboard" aria-label="easyrent — dashboard" className="inline-flex items-center">
          <EasyrentLogo className="h-5 w-auto text-foreground" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/15 text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
