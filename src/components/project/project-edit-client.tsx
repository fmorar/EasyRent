"use client"

import { useState, useCallback, useEffect } from "react"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
import { ProjectForm, type ProjectFormValues } from "@/components/project/project-form"
import { ProjectAmenitiesEditor } from "@/components/project/project-amenities-editor"
import ProjectPhotoUploader from "@/components/project/project-photo-uploader"
import { ProjectFaqsEditor } from "@/components/project/project-faqs-editor"
import { ProjectPropertiesEditor } from "@/components/project/project-properties-editor"
import { ProjectPreview } from "@/components/project/project-preview"
import { FormSection } from "@/components/shared/form-section"
import { FormToc } from "@/components/shared/form-toc"
import type { Project, Profile } from "@/types"
import type {
  ProjectAmenityRow,
  ProjectPhotoRow,
  ProjectFaqRow,
  ProjectLinkedPropertyRow,
} from "@/lib/actions/project-media.actions"

interface Props {
  mode:                "create" | "edit"
  profile:             Profile
  project?:            Project              // required for edit mode
  initialAmenities:    ProjectAmenityRow[]
  initialPhotos:       ProjectPhotoRow[]
  initialFaqs:         ProjectFaqRow[]
  initialProperties:   ProjectLinkedPropertyRow[]
}

const FORM_ID              = "project-details-form"
const SCROLL_CONTAINER_ID  = "project-form-scroll"

const TOC_BASE = [
  { id: "basic",      label: "Información básica" },
  { id: "details",    label: "Detalles" },
  { id: "units",      label: "Unidades y entrega" },
  { id: "visibility", label: "Visibilidad" },
]
const TOC_EDIT_EXTRAS = [
  { id: "amenities",  label: "Amenidades" },
  { id: "photos",     label: "Fotos" },
  { id: "faqs",       label: "Preguntas frecuentes" },
  { id: "properties", label: "Propiedades" },
]

// Merge form values into the live preview snapshot.
function mergeFormValues(base: Project, values: Partial<ProjectFormValues>): Project {
  return {
    ...base,
    title:              values.title              ?? base.title,
    description:        (values.description       ?? base.description) || base.description,
    developer_name:     (values.developer_name    ?? base.developer_name) || base.developer_name,
    location_label:     (values.location_label    ?? base.location_label) || base.location_label,
    total_units:        values.total_units        ?? base.total_units,
    available_units:    values.available_units    ?? base.available_units,
    completion_date:    values.completion_date    ?? base.completion_date,
    status:             values.status             ?? base.status,
    is_master_template: values.is_master_template ?? base.is_master_template,
  }
}

// Sensible defaults for the create-mode preview seed
function buildEmptyProject(profileId: string): Project {
  return {
    id:                 "preview",
    created_by:         profileId,
    title:              "",
    slug:               "preview",
    description:        null,
    developer_name:     null,
    location_label:     null,
    total_units:        null,
    available_units:    null,
    completion_date:    null,
    status:             "under_construction",
    is_master_template: false,
    is_public:          false,
    google_place_id:    null,
    is_active:          true,
    forked_from:        null,
    created_at:         new Date().toISOString(),
    updated_at:         new Date().toISOString(),
    deleted_at:         null,
  }
}

export function ProjectEditClient({
  mode,
  profile,
  project,
  initialAmenities,
  initialPhotos,
  initialFaqs,
  initialProperties,
}: Props) {
  const seed = project ?? buildEmptyProject(profile.id)

  const [formDirty,    setFormDirty]    = useState(false)
  const { blocking, confirm, cancel }   = useUnsavedChanges(formDirty)

  const [liveProject,  setLiveProject]  = useState<Project>(seed)
  const [liveAmenityNames, setLiveAmenityNames] = useState<string[]>(
    [...initialAmenities].sort((a, b) => a.sort_order - b.sort_order).map((a) => a.name),
  )

  // Notify SaveFormButton about dirty state changes
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("form:dirty-change", {
        detail: { formId: FORM_ID, dirty: formDirty },
      }),
    )
  }, [formDirty])

  const handleFormChange = useCallback(
    (values: Partial<ProjectFormValues>) => {
      setLiveProject((prev) => mergeFormValues(prev, values))
    },
    [],
  )

  const tocSections = mode === "edit"
    ? [...TOC_BASE, ...TOC_EDIT_EXTRAS]
    : TOC_BASE

  return (
    <>
      {/* ── Unsaved changes dialog ──────────────────────────── */}
      {blocking && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background rounded-xl border shadow-xl p-6 w-full max-w-sm mx-4 space-y-4">
            <div className="space-y-1.5">
              <h2 className="text-base font-heading font-semibold">¿Salir sin guardar?</h2>
              <p className="text-sm text-muted-foreground">
                Tenés cambios sin guardar. Si salís ahora vas a perder el progreso.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={cancel}
                className="px-4 py-2 text-sm font-medium rounded-lg border hover:bg-muted transition-colors"
              >
                Quedarme
              </button>
              <button
                onClick={confirm}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── LEFT — TOC + form column (scrollable) ─────────── */}
        <div
          id={SCROLL_CONTAINER_ID}
          className="flex-1 overflow-y-auto min-w-0"
        >
          {/* Width steps mirror the property edit page — see the
              comment there. Cramped working area on 27"/32" monitors. */}
          <div className="mx-auto max-w-5xl xl:max-w-6xl 2xl:max-w-[1600px] px-4 sm:px-6 py-6 sm:py-8 grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-6 lg:gap-8">

            {/* TOC — sticky on lg+ */}
            <aside className="hidden lg:block">
              <FormToc sections={tocSections} scrollContainerId={SCROLL_CONTAINER_ID} />
            </aside>

            {/* Form column */}
            <div className="min-w-0 space-y-(--spacing-block)">
              <ProjectForm
                mode={mode}
                profile={profile}
                project={project}
                hideActions
                formId={FORM_ID}
                onFormChange={handleFormChange}
                onDirtyChange={setFormDirty}
              />

              {mode === "edit" && project && (
                <>
                  <FormSection
                    id="amenities"
                    number={5}
                    title="Amenidades"
                    description="Lo que ofrece el edificio. Las propiedades del proyecto las heredan automáticamente."
                    optional
                  >
                    <ProjectAmenitiesEditor
                      projectId={project.id}
                      initialAmenities={initialAmenities}
                      onChange={setLiveAmenityNames}
                    />
                  </FormSection>

                  <FormSection
                    id="photos"
                    number={6}
                    title="Fotos"
                    description="Fachada, amenidades, áreas comunes. La primera será la portada."
                  >
                    <ProjectPhotoUploader
                      projectId={project.id}
                      initialPhotos={initialPhotos}
                    />
                  </FormSection>

                  <FormSection
                    id="faqs"
                    number={7}
                    title="Preguntas frecuentes"
                    description="Acordeón en la página pública del proyecto."
                    optional
                  >
                    <ProjectFaqsEditor
                      projectId={project.id}
                      initialFaqs={initialFaqs}
                    />
                  </FormSection>

                  <FormSection
                    id="properties"
                    number={8}
                    title="Propiedades"
                    description="Vincula tus propiedades existentes al proyecto. Heredarán automáticamente los datos."
                    optional
                  >
                    <ProjectPropertiesEditor
                      projectId={project.id}
                      initialLinked={initialProperties}
                    />
                  </FormSection>
                </>
              )}

              {mode === "create" && (
                <p className="text-xs text-muted-foreground italic pt-(--spacing-cluster)">
                  Las amenidades, fotos, FAQs y propiedades vinculadas podrás agregarlas una vez creado el proyecto.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT — sticky preview ─────────────────────────── */}
        <div className="hidden xl:flex flex-col w-[480px] shrink-0 border-l">
          <div className="px-5 py-4 border-b bg-muted/30 shrink-0 flex items-center justify-between">
            <p className="text-sm font-heading font-semibold">Vista previa</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ProjectPreview
              project={liveProject}
              amenities={liveAmenityNames}
              photos={initialPhotos}
            />
          </div>
        </div>
      </div>
    </>
  )
}
