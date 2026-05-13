import { PublicHeader } from "@/components/layout/public-header"
import { createClient } from "@/lib/supabase/server"

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Public projects feed both the desktop pill nav (dropdown when 2+)
  // and the mobile sheet menu. Pulled server-side so the header SSRs
  // with no flash on first paint.
  const supabase = await createClient()
  const [{ data: publicProjects }, { data: { user } }] = await Promise.all([
    supabase
      .from("projects")
      .select("slug, title")
      .eq("is_master_template", true)
      .eq("is_public", true)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("title", { ascending: true }),
    supabase.auth.getUser(),
  ])

  const projects   = publicProjects ?? []
  const isSignedIn = !!user

  return (
    <div data-surface="public" className="min-h-screen bg-background">
      <PublicHeader projects={projects} isSignedIn={isSignedIn} />
      <main>{children}</main>
    </div>
  )
}
