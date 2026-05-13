"use client"

import { useState, useCallback, useEffect } from "react"
import { useTranslations } from "next-intl"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
import { LockClosedIcon } from "@heroicons/react/24/outline"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import PropertyForm from "@/components/property/property-form"
import { TranslationTab } from "@/components/property/translation-tab"
import PhotoUploader from "@/components/property/photo-uploader"
import VideoManager from "@/components/property/video-manager"
import PropertyPreview from "@/components/property/property-preview"
import { FormSection } from "@/components/shared/form-section"
import { FormToc } from "@/components/shared/form-toc"
import { GlobeAltIcon } from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils"
import type { Property, Owner, Profile } from "@/types"
import type { PhotoRow } from "@/components/property/photo-uploader"
import type { VideoRow } from "@/lib/actions/media.actions"
import type { PropertyTranslation } from "@/lib/actions/translation.actions"
import type { DeepPartial } from "react-hook-form"
import { mergePropertyWithProject, type ProjectInheritance } from "@/lib/inheritance"

// ── Types ─────────────────────────────────────────────────────────
interface Project {
  id:                 string
  title:              string
  slug:               string
  is_master_template: boolean
  forked_from:        string | null
}

interface Props {
  property:           Property
  profile:            Profile
  projects:           Project[]
  initialOwner:       Owner | null
  photos:             PhotoRow[]
  videos:             VideoRow[]
  enTranslation:      PropertyTranslation | null
  projectInheritance: ProjectInheritance | null
  /** True when the current viewer owns the property or is an admin.
   *  False when the row was made visible via property_shares — they
   *  see everything but every input is disabled. */
  canEdit:            boolean
  tTabEn:             string
  tAiNote:            string
}

// ── Sections (mirror PropertyForm + media) ────────────────────────
const TOC_SECTIONS = [
  { id: "basic",        label: "Información básica" },
  { id: "specs",        label: "Especificaciones" },
  { id: "location",     label: "Ubicación" },
  { id: "amenities",    label: "Amenidades" },
  { id: "description",  label: "Descripción" },
  { id: "associations", label: "Proyecto y dueño" },
  { id: "media",        label: "Fotos y videos" },
]

const SCROLL_CONTAINER_ID = "property-form-scroll"

// Merge deep-partial form values into the live property snapshot
function mergeFormValues(base: Property, values: DeepPartial<Record<string, unknown>>): Property {
  const n = (v: unknown, fallback: number | null | undefined) =>
    v != null && v !== "" ? (Number(v) || fallback) : fallback

  return {
    ...base,
    title:           (values.title         as string | undefined) ?? base.title,
    description:     (values.description   as string | undefined) ?? base.description,
    price:           n(values.price,           base.price)           as number,
    currency:        (values.currency      as string | undefined) ?? base.currency,
    property_type:   (values.property_type as Property["property_type"] | undefined) ?? base.property_type,
    status:          (values.status        as Property["status"]        | undefined) ?? base.status,
    location_mode:   (values.location_mode as Property["location_mode"] | undefined) ?? base.location_mode,
    public_address:  (values.public_address  as string | undefined) ?? base.public_address,
    display_address: (values.public_address  as string | undefined) ?? base.display_address,
    amenities:       (values.amenities      as string[] | undefined) ?? base.amenities,
    bedrooms:        n(values.bedrooms,       base.bedrooms)       as number | null,
    bathrooms:       n(values.bathrooms,      base.bathrooms)      as number | null,
    area_sqm:        n(values.area_sqm,       base.area_sqm)       as number | null,
    floor:           n(values.floor,          base.floor)          as number | null,
    parking_spaces:  n(values.parking_spaces, base.parking_spaces) as number | null,
  }
}

// ── Component ─────────────────────────────────────────────────────
export function PropertyEditClient({
  property,
  profile,
  projects,
  initialOwner,
  photos,
  videos,
  enTranslation,
  projectInheritance,
  canEdit,
  tTabEn,
  tAiNote,
}: Props) {
  const readOnly = !canEdit
  const tEdit    = useTranslations("propertyEdit")
  const [formDirty,      setFormDirty]      = useState(false)
  const { blocking, confirm, cancel }        = useUnsavedChanges(formDirty)

  const [liveProperty,   setLiveProperty]   = useState<Property>(property)
  const [liveOwner,      setLiveOwner]      = useState<Owner | null>(initialOwner)
  const [showEnglish,    setShowEnglish]    = useState<boolean>(enTranslation !== null)
  const [activeTab,      setActiveTab]      = useState<string>("es")

  // Live English content for the preview (updated as user types in the EN tab)
  const [liveEnglish, setLiveEnglish] = useState({
    title:       enTranslation?.title       ?? "",
    description: enTranslation?.description ?? "",
  })

  // What the preview renders — language-aware + project-inheritance-aware.
  const merged        = mergePropertyWithProject(liveProperty, projectInheritance)
  const previewProperty: Property =
    activeTab === "en" && showEnglish
      ? {
          ...merged,
          title:       liveEnglish.title       || merged.title,
          description: liveEnglish.description || merged.description,
        }
      : merged

  // Notify SaveFormButton (and any other listener) about dirty state changes.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("form:dirty-change", {
        detail: { formId: "property-details-form", dirty: formDirty },
      }),
    )
  }, [formDirty])

  const handleFormChange = useCallback(
    (values: DeepPartial<Record<string, unknown>>) => {
      setLiveProperty((prev) => mergeFormValues(prev, values))
    },
    [],
  )

  const handleOwnerChange = useCallback((owner: Owner | null) => {
    setLiveOwner(owner)
  }, [])

  const englishToggle = (
    <button
      type="button"
      role="switch"
      aria-checked={showEnglish}
      onClick={() => setShowEnglish((v) => !v)}
      className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      <GlobeAltIcon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Mostrar inglés</span>
      <span
        className={cn(
          "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
          showEnglish ? "bg-primary" : "bg-input",
        )}
      >
        <span
          className={cn(
            "pointer-events-none block h-3 w-3 rounded-full bg-background shadow-sm ring-0 transition-transform duration-200",
            showEnglish ? "translate-x-3" : "translate-x-0",
          )}
        />
      </span>
    </button>
  )

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

        {/* ── LEFT — TOC + editable sections (scrollable) ───── */}
        <div
          id={SCROLL_CONTAINER_ID}
          className="flex-1 overflow-y-auto min-w-0"
        >
          {/* Working-area width: max-w-5xl is right for laptops but
              cramped on 27"/32" monitors where the form column sits
              centered with a sea of whitespace around it. Step up at
              xl/2xl so big displays actually use their real estate
              (the photo grid + amenities + form sections all benefit
              from the extra columns). Capped at 1600px so prose lines
              don't get too long to scan. */}
          <div className="mx-auto max-w-5xl xl:max-w-6xl 2xl:max-w-[1600px] px-4 sm:px-6 py-6 sm:py-8 grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-6 lg:gap-8">

            {/* TOC — sticky on lg+ */}
            <aside className="hidden lg:block">
              <FormToc
                sections={TOC_SECTIONS}
                scrollContainerId={SCROLL_CONTAINER_ID}
              />
            </aside>

            {/* Form column */}
            <div className="min-w-0 space-y-(--spacing-block)">

              {/* Read-only banner — only when the viewer reached this
                  row via property_shares (not as owner/admin). The EN
                  toggle is hidden because the only thing it could do
                  in read-only mode is fail to generate a translation. */}
              {readOnly && (
                <div className="flex items-start gap-3 rounded-xl border bg-muted/40 px-4 py-3">
                  <LockClosedIcon className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm font-medium">{tEdit("readOnlyTitle")}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {tEdit("readOnlyDesc")}
                    </p>
                  </div>
                </div>
              )}

              {/* Top control row — language toggle (owners only) */}
              {!readOnly && (
                <div className="flex items-center justify-end">
                  {englishToggle}
                </div>
              )}

              {/* Form (single language) or Tabs (ES + EN) */}
              {showEnglish ? (
                <Tabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="space-y-5"
                >
                  <TabsList>
                    <TabsTrigger value="es">Español</TabsTrigger>
                    <TabsTrigger value="en">{tTabEn || "English"}</TabsTrigger>
                  </TabsList>

                  <TabsContent value="es" keepMounted>
                    <PropertyForm
                      mode="edit"
                      profile={profile}
                      projects={projects}
                      property={property}
                      initialOwner={initialOwner}
                      hideActions
                      readOnly={readOnly}
                      onFormChange={handleFormChange}
                      onOwnerChange={handleOwnerChange}
                      onDirtyChange={setFormDirty}
                    />
                  </TabsContent>

                  <TabsContent value="en" keepMounted>
                    <TranslationTab
                      propertyId={property.id}
                      locale="en"
                      translation={enTranslation}
                      readOnly={readOnly}
                      onContentChange={setLiveEnglish}
                      propertyContext={{
                        title:              liveProperty.title,
                        property_type:      liveProperty.property_type,
                        status:             liveProperty.status,
                        price:              liveProperty.price,
                        currency:           liveProperty.currency,
                        public_address:     liveProperty.public_address,
                        exact_address:      liveProperty.exact_address,
                        bedrooms:           liveProperty.bedrooms,
                        bathrooms:          liveProperty.bathrooms,
                        area_sqm:           liveProperty.area_sqm,
                        floor:              liveProperty.floor,
                        parking_spaces:     liveProperty.parking_spaces,
                        amenities:          merged.amenities_combined,
                        source_description: merged.description,
                      }}
                    />
                  </TabsContent>
                </Tabs>
              ) : (
                <PropertyForm
                  mode="edit"
                  profile={profile}
                  projects={projects}
                  property={property}
                  initialOwner={initialOwner}
                  hideActions
                  onFormChange={handleFormChange}
                  onOwnerChange={handleOwnerChange}
                  onDirtyChange={setFormDirty}
                />
              )}

              {/* § 7 — Fotos y videos (matches FormSection rhythm) */}
              <FormSection
                id="media"
                number={7}
                title="Fotos y videos"
                description="Subí fotos y arrastrá para ordenarlas. La primera será la portada."
              >
                <PhotoUploader
                  propertyId={property.id}
                  initialPhotos={photos}
                  readOnly={readOnly}
                />
                <div className="pt-2">
                  <VideoManager
                    propertyId={property.id}
                    initialVideos={videos}
                    readOnly={readOnly}
                  />
                </div>
              </FormSection>

              {tAiNote && (
                <p className="text-[11px] text-muted-foreground text-center pt-(--spacing-cluster)">
                  {tAiNote}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT — sticky preview ─────────────────────────── */}
        <div className="hidden xl:flex flex-col w-[480px] shrink-0 border-l">
          <div className="px-5 py-4 border-b bg-muted/30 shrink-0 flex items-center justify-between">
            <p className="text-sm font-heading font-semibold">Vista previa</p>
            <span className="text-xs text-muted-foreground">
              {activeTab === "en" && showEnglish ? "🇺🇸 English" : "🇪🇸 Español"}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <PropertyPreview
              property={previewProperty}
              photos={photos}
              videos={videos}
              owner={liveOwner}
            />
          </div>
        </div>

      </div>
    </>
  )
}
