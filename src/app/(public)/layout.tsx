import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { PublicProjectsNav } from "@/components/layout/public-projects-nav"
import { PublicMobileMenu } from "@/components/layout/public-mobile-menu"
import { EasyrentLogo } from "@/components/shared/easyrent-logo"
import { createClient } from "@/lib/supabase/server"

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: publicProjects } = await supabase
    .from("projects")
    .select("slug, title")
    .eq("is_public", true)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("title", { ascending: true })

  const projects = publicProjects ?? []

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          <Link
            href="/marketplace"
            aria-label="easyrent — inicio"
            className="shrink-0 inline-flex items-center transition-opacity duration-(--duration-state) ease-(--ease-out-quart) hover:opacity-80"
          >
            <EasyrentLogo className="h-7 w-auto text-foreground" />
          </Link>

          <nav className="hidden sm:flex items-center gap-3 sm:gap-4">
            <Link href="/marketplace" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Marketplace
            </Link>
            <PublicProjectsNav projects={projects} />
            <Link href="/login" className={buttonVariants({ size: "sm", variant: "outline" })}>
              Sign in
            </Link>
          </nav>

          <PublicMobileMenu
            marketplaceLabel="Marketplace"
            signInLabel="Sign in"
            projects={projects}
          />
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
