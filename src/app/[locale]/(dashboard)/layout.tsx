import { requireAuth } from "@/lib/auth"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { DashboardHeader } from "@/components/layout/dashboard-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { AgentFirstPropertyTour } from "@/components/onboarding/agent-first-property-tour"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile } = await requireAuth()

  // First-property tour: auto-launches once on first visit for agents
  // and owner_admins who haven't completed it yet. Super_admin is the
  // platform founder who already knows the product, so they skip it.
  const shouldRunTour =
    !profile.tour_completed_at
    && (profile.role === "agent" || profile.role === "owner_admin")

  return (
    <AgentFirstPropertyTour shouldRun={shouldRunTour}>
      <SidebarProvider>
        <AppSidebar
          role={profile.role}
          fullName={profile.full_name}
          email={profile.email}
          slug={profile.slug}
          avatarUrl={profile.avatar_url}
        />
        {/* `min-w-0` is required so the inset (and its inner wrappers) can
            shrink below the content's intrinsic width. Without it, wide
            children like data tables push <main> beyond the viewport,
            knocking buttons and the right edge off-screen. */}
        <SidebarInset className="min-w-0">
          <DashboardHeader profile={profile} />
          {/* Spacing intent:
              • `px-4 sm:px-6` — page gutter (consistent with header).
              • `pb-(--spacing-section)` — generous bottom for landing on
                a clean horizon, not a button hugging the viewport edge.
              Vertical rhythm WITHIN the page is delegated to each page,
              which knows its own block hierarchy. The shell stays out
              of that decision. */}
          <main className="flex flex-1 flex-col px-4 sm:px-6 pb-(--spacing-section) pt-2 min-w-0">
            {children}
          </main>
        </SidebarInset>
        <Toaster position="bottom-right" richColors closeButton />
      </SidebarProvider>
    </AgentFirstPropertyTour>
  )
}
