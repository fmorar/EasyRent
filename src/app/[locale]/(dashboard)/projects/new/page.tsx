import Link from "next/link"
import { requireAuth } from "@/lib/auth"
import { ProjectEditClient } from "@/components/project/project-edit-client"
import { SaveFormButton } from "@/components/property/save-form-button"
import { ArrowLeftIcon } from "@heroicons/react/24/outline"

export default async function NewProjectPage() {
  const { profile } = await requireAuth()

  return (
    <div className="-mx-4 -mb-4 flex flex-col" style={{ height: "calc(100svh - 64px)" }}>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 px-6 py-3 border-b bg-background">
        <Link
          href="/projects"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Proyectos
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm font-medium">Nuevo proyecto</span>

        <div className="ml-auto flex items-center gap-3 shrink-0">
          <SaveFormButton
            formId="project-details-form"
            label="Crear proyecto"
            savedLabel="Proyecto creado"
          />
        </div>
      </div>

      <ProjectEditClient
        mode="create"
        profile={profile}
        initialAmenities={[]}
        initialPhotos={[]}
        initialFaqs={[]}
        initialProperties={[]}
      />
    </div>
  )
}
