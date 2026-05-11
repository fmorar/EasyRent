import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import PropertyForm from "@/components/property/property-form"

export default async function NewPropertyPage() {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  // Load active projects so the form can link to a project
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, slug, is_master_template, forked_from")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("title")

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New property</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fill in the details. The property will be private until shared or approved for marketplace.
        </p>
      </div>

      <PropertyForm
        mode="create"
        profile={profile}
        projects={projects ?? []}
      />
    </div>
  )
}
