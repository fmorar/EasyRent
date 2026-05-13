"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { createProject, updateProject } from "@/lib/actions/project.actions"
import { isAdminRole } from "@/lib/roles"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { AddressAutocomplete } from "@/components/property/address-autocomplete"
import { resolveGooglePlaceId } from "@/lib/actions/places.actions"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert } from "@/components/ui/alert"
import { FormSection } from "@/components/shared/form-section"
import { ToggleRow } from "@/components/shared/toggle-row"
import type { Project, Profile, ProjectStatus } from "@/types"

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "pre_launch",         label: "Pre-lanzamiento" },
  { value: "under_construction", label: "En construcción" },
  { value: "completed",          label: "Completado" },
  { value: "on_hold",            label: "En pausa" },
]

const projectSchema = z.object({
  title:              z.string().min(1, "Título requerido"),
  description:        z.string().optional(),
  developer_name:     z.string().optional(),
  location_label:     z.string().optional(),
  total_units:        z.coerce.number().int().nonnegative().nullable().optional(),
  available_units:    z.coerce.number().int().nonnegative().nullable().optional(),
  completion_date:    z.string().optional(),
  status:             z.enum(["pre_launch", "under_construction", "completed", "on_hold"]),
  is_master_template: z.boolean().optional(),
  is_public:          z.boolean().optional(),
  google_place_id:    z.string().optional(),
})

export type ProjectFormValues = z.infer<typeof projectSchema>

interface Props {
  mode:           "create" | "edit"
  profile:        Profile
  project?:       Project
  /** Hide the inline submit button (when an external SaveFormButton is used). */
  hideActions?:   boolean
  /** Form id used by an external submit button to wire up via the `form` attr. */
  formId?:        string
  /** Notify parent of every form value change for live previews. */
  onFormChange?:  (values: Partial<ProjectFormValues>) => void
  /** Notify parent when the dirty state flips. */
  onDirtyChange?: (dirty: boolean) => void
}

export function ProjectForm({
  mode, profile, project,
  hideActions = false,
  formId      = "project-details-form",
  onFormChange,
  onDirtyChange,
}: Props) {
  const router  = useRouter()
  const t       = useTranslations("projectForm")
  // Include super_admin — they get the same operational privileges as
  // owner_admin (the SQL is_admin() helper treats them the same).
  // Narrow comparison silently hid the "master template" toggle from
  // super_admin and dropped is_master_template in createProject.
  const isAdmin = isAdminRole(profile.role)

  const [serverError, setServerError] = useState<string | null>(null)
  const [savedOk,     setSavedOk]     = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProjectFormValues, unknown, ProjectFormValues>({
    resolver: zodResolver(projectSchema) as import("react-hook-form").Resolver<ProjectFormValues>,
    defaultValues: project ? {
      title:              project.title,
      description:        project.description     ?? "",
      developer_name:     project.developer_name  ?? "",
      location_label:     project.location_label  ?? "",
      total_units:        project.total_units,
      available_units:    project.available_units,
      completion_date:    project.completion_date ?? "",
      status:             project.status,
      is_master_template: project.is_master_template,
      is_public:          project.is_public,
      google_place_id:    project.google_place_id ?? "",
    } : {
      status:             "under_construction",
      is_master_template: false,
      is_public:          false,
      google_place_id:    "",
    },
  })

  const isMasterTemplate = watch("is_master_template")
  const isPublic         = watch("is_public")
  const status           = watch("status")
  const placeId          = watch("google_place_id")
  const [resolvingPlaceId, setResolvingPlaceId] = useState(false)

  // ── Notify parent of dirty state (unsaved-changes guard) ─────────
  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  // ── Live preview: emit every field change to parent ──────────────
  useEffect(() => {
    if (!onFormChange) return
    const { unsubscribe } = watch((values) => {
      onFormChange(values as Partial<ProjectFormValues>)
    })
    return unsubscribe
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFormChange])

  async function onSubmit(values: ProjectFormValues) {
    setServerError(null)
    setSavedOk(false)

    const payload = {
      title:              values.title,
      description:        values.description     || undefined,
      developer_name:     values.developer_name  || undefined,
      location_label:     values.location_label  || undefined,
      total_units:        values.total_units     ?? null,
      available_units:    values.available_units ?? null,
      completion_date:    values.completion_date || null,
      status:             values.status,
      is_master_template: values.is_master_template,
      is_public:          values.is_public,
      google_place_id:    values.google_place_id?.trim() || null,
    }

    let ok = false
    try {
      const result = mode === "create"
        ? await createProject(payload)
        : await updateProject(project!.id, payload)

      if (!result.success) {
        setServerError(result.error)
        toast.error(result.error ?? "Error al guardar")
        return
      }

      ok = true
      setSavedOk(true)
      toast.success(
        mode === "create" ? "Proyecto creado" : "Cambios guardados",
      )

      reset(values)

      if (mode === "create") {
        router.push(`/projects/${result.data.slug}/edit`)
      } else {
        router.refresh()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error inesperado al guardar"
      setServerError(msg)
      toast.error(msg)
    } finally {
      // Always reset the external SaveFormButton — failure included.
      document.getElementById(formId)?.dispatchEvent(
        new CustomEvent("form:saved", { detail: { ok }, bubbles: true }),
      )
    }
  }

  return (
    <form
      id={formId}
      onSubmit={handleSubmit(
        onSubmit,
        () => {
          document.getElementById(formId)?.dispatchEvent(
            new CustomEvent("form:saved", { detail: { ok: false }, bubbles: true }),
          )
          toast.error("Revisá los campos marcados en rojo.")
        },
      )}
      className="space-y-(--spacing-block)"
    >
      {serverError && (
        <Alert variant="destructive">
          <p className="text-sm">{serverError}</p>
        </Alert>
      )}

      {/* ─── § 1 — Información básica ─────────────────────────── */}
      <FormSection
        id="basic"
        number={1}
        title={t("section1Title")}
        description={t("section1Desc")}
      >
        <Field label="Título" required error={errors.title?.message}>
          <Input
            placeholder="Edificio Almendros"
            {...register("title")}
          />
        </Field>

        <Field label="Descripción">
          <RichTextEditor
            value={watch("description") ?? ""}
            onChange={(html) => setValue("description", html, { shouldDirty: true })}
            placeholder="Detalles del proyecto…"
          />
        </Field>
      </FormSection>

      {/* ─── § 2 — Detalles ───────────────────────────────────── */}
      <FormSection
        id="details"
        number={2}
        title={t("section2Title")}
        description={t("section2Desc")}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-(--spacing-cluster)">
          <Field label="Desarrollador">
            <Input placeholder="Inmobiliaria XYZ" {...register("developer_name")} />
          </Field>
          <Field
            label="Ubicación"
            hint={
              resolvingPlaceId
                ? "buscando en Google Places…"
                : placeId
                  ? "Google Place ID detectado ✓"
                  : "se autocompleta al escribir"
            }
          >
            <AddressAutocomplete
              value={watch("location_label") ?? ""}
              onChange={(v) => setValue("location_label", v, { shouldDirty: true })}
              onSelect={async (suggestion) => {
                setValue("location_label", suggestion.displayName, { shouldDirty: true })
                setResolvingPlaceId(true)
                const placeId = await resolveGooglePlaceId(suggestion.displayName)
                setResolvingPlaceId(false)
                if (placeId) {
                  setValue("google_place_id", placeId, { shouldDirty: true })
                }
              }}
              placeholder="Escazú, San José"
            />
          </Field>
        </div>
      </FormSection>

      {/* ─── § 3 — Unidades y entrega ─────────────────────────── */}
      <FormSection
        id="units"
        number={3}
        title={t("section3Title")}
        description={t("section3Desc")}
        optional
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-(--spacing-cluster)">
          <Field label="Total unidades">
            <Input type="number" min="0" {...register("total_units")} />
          </Field>
          <Field label="Disponibles">
            <Input type="number" min="0" {...register("available_units")} />
          </Field>
          <Field label="Fecha entrega">
            <Input type="date" {...register("completion_date")} />
          </Field>
          <Field label="Estado">
            <Select
              value={status}
              onValueChange={(v) =>
                v && setValue("status", v as ProjectStatus, { shouldDirty: true })
              }
            >
              <SelectTrigger>
                <SelectValue>
                  {(v: unknown) =>
                    STATUS_OPTIONS.find((o) => o.value === v)?.label ?? ""
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </FormSection>

      {/* ─── § 4 — Visibilidad ────────────────────────────────── */}
      <FormSection
        id="visibility"
        number={4}
        title={t("section4Title")}
        description={t("section4Desc")}
      >
        {/* Public toggle */}
        <ToggleRow
          title={t("publicTitle")}
          description={
            <>
              {t("publicDescPrefix")}{" "}
              <code className="text-[11px] bg-muted px-1 rounded">/projects/&lt;slug&gt;</code>{" "}
              {t("publicDescSuffix")}
            </>
          }
          checked={isPublic ?? false}
          onChange={() => setValue("is_public", !isPublic, { shouldDirty: true })}
        />

        {/* Admin-only master template toggle */}
        {isAdmin && (
          <ToggleRow
            title={t("templateTitle")}
            description={t("templateDesc")}
            checked={isMasterTemplate ?? false}
            onChange={() =>
              setValue("is_master_template", !isMasterTemplate, { shouldDirty: true })
            }
          />
        )}
      </FormSection>

      {!hideActions && (
        <div className="flex items-center gap-3 pt-(--spacing-block)">
          <Button type="submit" disabled={isSubmitting || (mode === "edit" && !isDirty)}>
            {isSubmitting
              ? "Guardando…"
              : mode === "create"
                ? "Crear proyecto"
                : "Guardar cambios"}
          </Button>
          {savedOk && (
            <span className="text-xs text-success">✓ Guardado</span>
          )}
        </div>
      )}
    </form>
  )
}

// ─────────────────────────────────────────────
function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label:     string
  required?: boolean
  hint?:     string
  error?:    string
  children:  React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
        {hint && <span className="font-normal opacity-60">· {hint}</span>}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
