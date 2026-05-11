"use client"

import React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { LocaleSwitcher } from "@/components/layout/locale-switcher"
import type { Profile } from "@/types"

// Map path segments → readable labels
const LABELS: Record<string, string> = {
  dashboard:             "Dashboard",
  properties:            "Properties",
  projects:              "Projects",
  leads:                 "Leads",
  contracts:             "Contracts",
  "market-analysis":     "Market Analysis",
  "performance-reports": "Performance Reports",
  agents:                "Agents",
  invitations:           "Invitations",
  shares:                "Share Requests",
  settings:              "Settings",
  new:                   "New",
}

interface DashboardHeaderProps {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  profile: Profile
}

export function DashboardHeader({ profile: _profile }: DashboardHeaderProps) {
  const pathname = usePathname()

  // Only show segments that have a known label — this drops locale prefixes,
  // UUIDs, slugs, and any other dynamic segments that detail pages handle themselves.
  const segments = pathname
    .split("/")
    .filter((seg) => Boolean(seg) && Boolean(LABELS[seg]))

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        {segments.length > 0 && (
          <Breadcrumb>
            <BreadcrumbList>
              {segments.map((seg, i) => {
                const isLast = i === segments.length - 1
                const href   = "/" + pathname.split("/").slice(0, pathname.split("/").indexOf(seg) + 1).join("/")
                const label  = LABELS[seg]

                return (
                  <React.Fragment key={seg}>
                    <BreadcrumbItem>
                      {isLast ? (
                        <BreadcrumbPage>{label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink render={<Link href={href} />}>
                          {label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!isLast && <BreadcrumbSeparator />}
                  </React.Fragment>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        )}
      </div>
      <LocaleSwitcher />
    </header>
  )
}
