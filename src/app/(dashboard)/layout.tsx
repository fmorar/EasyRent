import { requireAuth } from "@/lib/auth"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { DashboardHeader } from "@/components/layout/dashboard-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile } = await requireAuth()

  return (
    <SidebarProvider>
      <AppSidebar
        role={profile.role}
        fullName={profile.full_name}
        email={profile.email}
        slug={profile.slug}
        avatarUrl={profile.avatar_url}
      />
      <SidebarInset>
        <DashboardHeader profile={profile} />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
