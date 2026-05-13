"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"
import { createProperty, updateProperty } from "@/lib/actions/property.actions"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { OwnerSelector } from "@/components/property/owner-selector"
import { aiRewriteDescription } from "@/lib/actions/description.actions"
import { AddressAutocomplete } from "@/components/property/address-autocomplete"
import { AmenitiesPicker } from "@/components/property/amenities-picker"
import { VoiceIntakeButton, type VoiceIntakeFields } from "@/components/property/voice-intake-button"
import { FormSection } from "@/components/shared/form-section"
import { ToggleRow } from "@/components/shared/toggle-row"
import { CheckCircleIcon, MapPinIcon } from "@heroicons/react/24/outline"
import { geocodeToApproximate } from "@/lib/actions/geocoding.actions"
import type { AddressSuggestion } from "@/lib/actions/geocoding.types"
import type { Profile, Property, Owner } from "@/types"
import type { DeepPartial } from "react-hook-form"

// ── Schema ────────────────────────────────────────────────────────
// Coerce empty strings, null, and NaN to `null` BEFORE the inner schema
// runs. Without this:
//  • `z.coerce.number()` turns null/"" into 0, which would then fail any
//    `.positive()`/`.min(1)` constraint downstream — invisibly.
//  • `Number()` of any garbage (whitespace-only, malformed numeric
//    string, already-NaN value) returns `NaN`, which `z.number()`
//    explicitly rejects.
function toNullableNumber(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

const nullableNumber = z.preprocess(
  toNullableNumber,
  z.number().nullable(),
)
const nullablePositive = z.preprocess(
  toNullableNumber,
  z.number().positive().nullable(),
)
const nullableNonNegInt = z.preprocess(
  toNullableNumber,
  z.number().int().min(0).nullable(),
)
const nullableInt = z.preprocess(
  toNullableNumber,
  z.number().int().nullable(),
)

const propertySchema = z.object({
  title:          z.string().min(3, "El título es requerido"),
  description:    z.string().optional(),
  price:          z.coerce.number().positive("El precio debe ser mayor a 0"),
  currency:       z.string().default("USD"),
  property_type:  z.enum(["apartment", "house", "land", "commercial", "office", "warehouse"]),
  listing_type:   z.enum(["sale", "rent"]).default("sale"),
  is_furnished:   z.boolean().default(false),
  status:         z.enum(["available", "reserved", "sold", "off_market"]).default("available"),
  location_mode:  z.enum(["exact", "approximate"]).default("approximate"),
  public_address: z.string().optional(),
  exact_address:  z.string().optional(),
  // Hidden — populated by the address autocomplete / blur geocode.
  exact_lat:      nullableNumber.optional(),
  exact_lng:      nullableNumber.optional(),
  display_lat:    nullableNumber.optional(),
  display_lng:    nullableNumber.optional(),
  bedrooms:       nullableNonNegInt.optional(),
  bathrooms:      nullableNonNegInt.optional(),
  area_sqm:       nullablePositive.optional(),
  floor:          nullableInt.optional(),
  parking_spaces: nullableNonNegInt.optional(),
  project_id:     z.string().optional().nullable(),
  owner_id:       z.string().optional().nullable(),
  amenities:      z.array(z.string()).default([]),
})

type PropertyFormValues = z.infer<typeof propertySchema>

// ── Label maps ────────────────────────────────────────────────────
const TYPE_OPTIONS = [
  { value: "apartment", label: "Apartamento" },
  { value: "house",     label: "Casa" },
  { value: "land",      label: "Terreno" },
  { value: "commercial",label: "Comercial" },
  { value: "office",    label: "Oficina" },
  { value: "warehouse", label: "Bodega" },
]

const LISTING_TYPE_OPTIONS = [
  { value: "sale", label: "En venta"    },
  { value: "rent", label: "En alquiler" },
]

const STATUS_OPTIONS = [
  { value: "available",  label: "Disponible" },
  { value: "reserved",   label: "Reservado" },
  { value: "sold",       label: "Vendido / Alquilado" },
  { value: "off_market", label: "Fuera de mercado" },
]

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD — Dólar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "CRC", label: "CRC — Colón" },
  { value: "PEN", label: "PEN — Sol" },
  { value: "COP", label: "COP — Peso Col." },
  { value: "MXN", label: "MXN — Peso Mex." },
]

// ── Types ─────────────────────────────────────────────────────────
interface Project {
  id:                 string
  title:              string
  slug:               string
  is_master_template: boolean
  forked_from:        string | null
}

interface PropertyFormProps {
  mode:            "create" | "edit"
  profile:         Profile
  projects:        Project[]
  property?:       Property
  initialOwner?:   Owner | null
  onSaved?:        () => void
  formId?:         string      // connect external submit button via HTML form attr
  hideActions?:    boolean     // hide the internal save/cancel buttons
  readOnly?:       boolean     // disable every input/button + skip submit
  onFormChange?:   (values: DeepPartial<PropertyFormValues>) => void  // live preview
  onOwnerChange?:  (owner: Owner | null) => void                      // live preview
  onDirtyChange?:  (dirty: boolean) => void                           // unsaved-changes guard
}

// ── Component ─────────────────────────────────────────────────────
export default function PropertyForm({
  mode, profile, projects, property, initialOwner, onSaved,
  formId = "property-details-form", hideActions = false,
  readOnly = false,
  onFormChange, onOwnerChange, onDirtyChange,
}: PropertyFormProps) {
  const router = useRouter()
  const locale = useLocale()
  const t      = useTranslations("propertyForm")
  const [serverError, setServerError] = useState<string | null>(null)
  const [savedOk,     setSavedOk]     = useState(false)
  const [ownerId,     setOwnerId]     = useState<string | null>(property?.owner_id ?? null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PropertyFormValues, unknown, PropertyFormValues>({
    resolver: zodResolver(propertySchema) as import("react-hook-form").Resolver<PropertyFormValues>,
    defaultValues: property ? {
      title:          property.title,
      description:    property.description ?? "",
      price:          property.price,
      currency:       property.currency,
      property_type:  property.property_type,
      listing_type:   property.listing_type ?? "sale",
      is_furnished:   property.is_furnished ?? false,
      status:         property.status,
      location_mode:  property.location_mode,
      public_address: property.public_address ?? "",
      exact_address:  property.exact_address  ?? "",
      exact_lat:      toNullableNumber(property.exact_lat),
      exact_lng:      toNullableNumber(property.exact_lng),
      display_lat:    toNullableNumber(property.display_lat),
      display_lng:    toNullableNumber(property.display_lng),
      bedrooms:       property.bedrooms,
      bathrooms:      property.bathrooms,
      area_sqm:       property.area_sqm,
      floor:          property.floor,
      parking_spaces: property.parking_spaces,
      project_id:     property.project_id,
      owner_id:       property.owner_id,
      amenities:      property.amenities ?? [],
    } : {
      listing_type:  "sale",
      is_furnished:  false,
      status:        "available",
      location_mode: "approximate",
      currency:      "USD",
      amenities:     [],
    },
  })

  const locationMode = watch("location_mode")

  // ── AI description rewrite ────────────────────────────────────────
  async function handleAiRewrite(currentHtml: string): Promise<string | null> {
    const v = getValues()
    const result = await aiRewriteDescription({
      title:               v.title,
      property_type:       v.property_type,
      status:              v.status,
      price:               v.price,
      currency:            v.currency,
      public_address:      v.public_address,
      exact_address:       v.exact_address,
      bedrooms:            v.bedrooms,
      bathrooms:           v.bathrooms,
      area_sqm:            v.area_sqm,
      floor:               v.floor,
      parking_spaces:      v.parking_spaces,
      amenities:           v.amenities,
      project_id:          v.project_id,
      current_description: currentHtml,
    })
    return result.success ? result.data : null
  }

  // ── Voice intake → form ──────────────────────────────────────────
  // Apply only the non-null fields the model extracted. We mark each
  // touched field as dirty so the unsaved-changes guard catches them
  // and the live preview (when wired) re-renders.
  function applyVoiceFields(fields: VoiceIntakeFields) {
    // RHF's PathValue inference fights the union when we apply many
    // fields in a loop. Cast through `never` per call — runtime
    // values come from the typed VoiceIntakeFields so we still have
    // the safety where it matters.
    const set = (k: keyof PropertyFormValues, v: unknown) =>
      setValue(k, v as never, { shouldDirty: true, shouldValidate: true })

    if (fields.title)          set("title",          fields.title)
    if (fields.description)    set("description",    fields.description)
    if (fields.property_type)  set("property_type",  fields.property_type)
    if (fields.listing_type)   set("listing_type",   fields.listing_type)
    if (fields.status)         set("status",         fields.status)
    if (fields.is_furnished != null)  set("is_furnished",  fields.is_furnished)
    if (fields.location_mode)         set("location_mode", fields.location_mode)
    if (fields.public_address)        set("public_address", fields.public_address)
    if (fields.price != null)         set("price",          fields.price)
    if (fields.currency)              set("currency",       fields.currency)
    if (fields.bedrooms != null)       set("bedrooms",       fields.bedrooms)
    if (fields.bathrooms != null)      set("bathrooms",      fields.bathrooms)
    if (fields.area_sqm != null)       set("area_sqm",       fields.area_sqm)
    if (fields.floor != null)          set("floor",          fields.floor)
    if (fields.parking_spaces != null) set("parking_spaces", fields.parking_spaces)
    if (fields.amenities && fields.amenities.length > 0) {
      // Merge with whatever the user already picked instead of clobbering.
      const existing = (getValues("amenities") as string[] | undefined) ?? []
      const seen = new Set(existing.map((a) => a.toLowerCase()))
      const merged = [...existing]
      for (const a of fields.amenities) {
        const key = a.toLowerCase()
        if (!seen.has(key)) { seen.add(key); merged.push(a) }
      }
      set("amenities", merged)
    }
  }

  // ── Approximate address (auto-generated, not user-entered) ────────
  const [approxAddress,    setApproxAddress]    = useState<string>(property?.public_address ?? "")
  const [approxGenerating, setApproxGenerating] = useState(false)

  // When user picks from autocomplete dropdown we already have the components
  function handleAddressSelect(suggestion: AddressSuggestion) {
    // Always capture coordinates — the map needs them. `display_*` mirror
    // `exact_*` since the visualisation in approximate mode is a circle,
    // which already obscures precision; storing both decoupled would let
    // a clever consumer derive the exact pin from display deltas.
    setValue("exact_lat",   suggestion.lat, { shouldDirty: true })
    setValue("exact_lng",   suggestion.lng, { shouldDirty: true })
    setValue("display_lat", suggestion.lat, { shouldDirty: true })
    setValue("display_lng", suggestion.lng, { shouldDirty: true })

    if (locationMode === "approximate") {
      const approx = suggestion.approximateName || suggestion.secondaryName
      setApproxAddress(approx)
      setValue("public_address", approx,                 { shouldDirty: true })
      setValue("exact_address",  suggestion.displayName, { shouldDirty: true })
    } else {
      setValue("public_address", suggestion.displayName, { shouldDirty: true })
      setValue("exact_address",  suggestion.displayName, { shouldDirty: true })
    }
  }

  // When user types manually and leaves the field, geocode to generate
  // both the approximate name AND the lat/lng for the map.
  async function handleAddressBlur() {
    const entered = watch("exact_address") ?? ""
    if (!entered.trim()) return
    if (locationMode !== "approximate" && entered === approxAddress) return

    setApproxGenerating(true)
    const result = await geocodeToApproximate(entered)
    setApproxGenerating(false)
    if (!result) return

    setValue("exact_lat",   result.lat, { shouldDirty: true })
    setValue("exact_lng",   result.lng, { shouldDirty: true })
    setValue("display_lat", result.lat, { shouldDirty: true })
    setValue("display_lng", result.lng, { shouldDirty: true })

    if (locationMode === "approximate") {
      setApproxAddress(result.approximateName)
      setValue("public_address", result.approximateName, { shouldDirty: true })
    }
  }

  // Re-generate when mode switches back to approximate and we have an exact address
  useEffect(() => {
    if (locationMode === "exact") {
      // exact mode: public = same as exact
      const addr = watch("exact_address") ?? watch("public_address") ?? ""
      setValue("public_address", addr)
      setApproxAddress(addr)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationMode])

  // ── Notify parent of dirty state (unsaved-changes guard) ─────────
  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  // ── Live preview: emit every field change to parent ──────────────
  useEffect(() => {
    if (!onFormChange) return
    const { unsubscribe } = watch((values) => {
      onFormChange(values)
    })
    return unsubscribe
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFormChange])

  async function onSubmit(values: PropertyFormValues) {
    setServerError(null)
    setSavedOk(false)

    // Snapshot the pre-save draft state. updateProperty graduates the
    // slug on the server when the row leaves `draft-*`, so checking
    // post-save would always be false. We use this to auto-open the
    // share dialog on the first save that publishes a draft, matching
    // the create-mode behavior.
    const wasDraft = property?.slug?.startsWith("draft-") ?? false

    let ok = false
    try {
      const result = mode === "create"
        ? await createProperty({ ...values, owner_id: ownerId })
        : await updateProperty(property!.id, { ...values, owner_id: ownerId })

      if (!result.success) {
        setServerError(result.error)
        toast.error(result.error ?? "Error al guardar")
        return
      }

      ok = true

      if (mode === "create" && result.data?.id) {
        toast.success("Propiedad creada")
        // Land on the edit page with ?share=1 so the share dialog auto-opens
        // — the agent can decide to share immediately or close it.
        // The locale prefix is mandatory: next/navigation's router.push
        // doesn't go through next-intl middleware, so an unprefixed path
        // 404s (or strips the query on a downstream redirect).
        router.push(`/${locale}/properties/${result.data.id}?share=1`)
        return
      }

      // Draft just graduated — prompt the agent to share, same as create.
      if (wasDraft && property?.id) {
        toast.success("Propiedad publicada")
        router.push(`/${locale}/properties/${property.id}?share=1`)
        return
      }

      router.refresh()
      reset(values)          // mark form as clean so the unsaved-changes guard deactivates
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 3000)
      toast.success("Cambios guardados")
      onSaved?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error inesperado al guardar"
      setServerError(msg)
      toast.error(msg)
    } finally {
      // Always notify the external <SaveFormButton> so it never gets stuck
      // in the "Guardando…" state. `detail.ok` distinguishes success from
      // failure for the button's UI state.
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
        // Validation failed — release the SaveFormButton so it can retry.
        (errors) => {
          document.getElementById(formId)?.dispatchEvent(
            new CustomEvent("form:saved", { detail: { ok: false }, bubbles: true }),
          )
          // Surface the first failing field so the user knows where to look.
          const fieldList = Object.keys(errors).join(", ")
          const firstMsg  = Object.values(errors)
            .map((e) => (e as { message?: string })?.message)
            .filter(Boolean)[0]
          // eslint-disable-next-line no-console
          console.warn("[PropertyForm] validation failed:", errors)
          toast.error(
            firstMsg
              ? `${firstMsg}${fieldList ? ` (${fieldList})` : ""}`
              : `Revisá los campos marcados: ${fieldList}.`,
          )
        },
      )}
      className="space-y-(--spacing-block)"
    >
      {/* fieldset disabled cascades to every native form control inside
          (inputs, selects, textareas, buttons) — the trick for read-only
          mode without threading `disabled` to each field. Tiptap + the
          AmenitiesPicker manage their own state, so we still pass
          `disabled={readOnly}` to those explicitly where they're
          rendered. `style={{display:contents}}` keeps the existing
          space-y-(--spacing-block) rhythm intact. */}
      <fieldset disabled={readOnly} style={{ display: "contents" }}>

      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      {/* ─── Voice intake — only on fresh drafts ───────────────
              The "new property" flow creates a draft with a slug
              prefixed `draft-` and routes here, so that's our signal
              for "this is a blank intake, dictation is welcome".
              Once the property has a real slug (i.e. it was already
              saved with content), we hide the banner so the agent
              can't accidentally overwrite a populated listing by
              dictating into it. */}
      {!readOnly && (property?.slug?.startsWith("draft-") ?? true) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-(--spacing-cluster) rounded-xl border border-dashed bg-muted/30 px-4 py-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">¿Preferís dictarlo?</p>
            <p className="text-xs text-muted-foreground">
              Hablá libremente sobre la propiedad y completamos los campos por vos. Podés editar todo después.
            </p>
          </div>
          <VoiceIntakeButton onApply={applyVoiceFields} />
        </div>
      )}

      {/* ─── § 1 — Información básica ────────────────────────── */}
      <FormSection
        id="basic"
        number={1}
        title={t("section1Title")}
        description={t("section1Desc")}
      >
        <Field
          label="Título"
          required
          hint="Tipo + zona + diferenciador concreto"
          error={errors.title?.message}
        >
          <Input
            id="title"
            placeholder="Ej. Casa de 4 habitaciones en Escazú con patio"
            {...register("title")}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-(--spacing-cluster)">
          <Field label="Tipo" required error={errors.property_type?.message}>
            <Select
              defaultValue={property?.property_type}
              onValueChange={(v) => v && setValue("property_type", v as PropertyFormValues["property_type"], { shouldDirty: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo">
                  {(v: unknown) =>
                    TYPE_OPTIONS.find((o) => o.value === v)?.label ?? "Tipo"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Operación" required>
            <Select
              defaultValue={property?.listing_type ?? "sale"}
              onValueChange={(v) => v && setValue("listing_type", v as PropertyFormValues["listing_type"], { shouldDirty: true })}
            >
              <SelectTrigger>
                <SelectValue>
                  {(v: unknown) =>
                    LISTING_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? "En venta"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {LISTING_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Estado">
            <Select
              defaultValue={property?.status ?? "available"}
              onValueChange={(v) => v && setValue("status", v as PropertyFormValues["status"], { shouldDirty: true })}
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
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-[2fr_1fr] gap-(--spacing-cluster)">
          <Field
            label={watch("listing_type") === "rent" ? "Alquiler mensual" : "Precio de venta"}
            required
            error={errors.price?.message}
          >
            <Input
              id="price"
              type="number"
              min="0"
              step={watch("listing_type") === "rent" ? "50" : "1000"}
              placeholder={watch("listing_type") === "rent" ? "1200" : "250000"}
              {...register("price")}
            />
          </Field>

          <Field label="Moneda">
            <Select defaultValue={property?.currency ?? "USD"} onValueChange={(v) => v && setValue("currency", v, { shouldDirty: true })}>
              <SelectTrigger>
                <SelectValue>
                  {(v: unknown) => (typeof v === "string" ? v : "USD")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {/* Furnished toggle — only relevant for rentals */}
        {watch("listing_type") === "rent" && (
          <ToggleRow
            title="Amueblado"
            description="Activá si el alquiler incluye muebles. Es uno de los filtros más usados por inquilinos."
            checked={watch("is_furnished") ?? false}
            onChange={() =>
              setValue("is_furnished", !watch("is_furnished"), { shouldDirty: true })
            }
            disabled={isSubmitting}
          />
        )}
      </FormSection>

      {/* ─── § 2 — Especificaciones ──────────────────────────── */}
      <FormSection
        id="specs"
        number={2}
        title={t("section2Title")}
        description={t("section2Desc")}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-(--spacing-cluster)">
          {([
            { id: "bedrooms",       label: "Habitaciones", placeholder: "3"   },
            { id: "bathrooms",      label: "Baños",        placeholder: "2"   },
            { id: "area_sqm",       label: "Área m²",      placeholder: "120" },
            { id: "parking_spaces", label: "Parqueos",     placeholder: "1"   },
            { id: "floor",          label: "Piso",         placeholder: "—"   },
          ] as const).map(({ id, label, placeholder }) => (
            <Field key={id} label={label}>
              <Input id={id} type="number" min="0" placeholder={placeholder} {...register(id)} />
            </Field>
          ))}
        </div>
      </FormSection>

      {/* ─── § 3 — Ubicación ─────────────────────────────────── */}
      <FormSection
        id="location"
        number={3}
        title={t("section3Title")}
        description={t("section3Desc")}
      >
        <Field
          label="Visibilidad pública"
          hint="Recomendado: zona aproximada · protege la dirección hasta coordinar visita"
        >
          <Select
            defaultValue={property?.location_mode ?? "approximate"}
            onValueChange={(v) => v && setValue("location_mode", v as "exact" | "approximate", { shouldDirty: true })}
          >
            <SelectTrigger>
              <SelectValue>
                {(v: unknown) =>
                  v === "exact" ? "Mostrar dirección exacta" : "Mostrar solo zona aproximada"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="min-w-[16rem]">
              <SelectItem value="approximate">Mostrar solo zona aproximada</SelectItem>
              <SelectItem value="exact">Mostrar dirección exacta</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field
          label={locationMode === "exact" ? "Dirección exacta" : "Dirección exacta · privada para agentes"}
        >
          <AddressAutocomplete
            id="exact_address"
            value={watch("exact_address") ?? watch("public_address") ?? ""}
            onChange={(v) => {
              setValue("exact_address", v, { shouldDirty: true })
              if (locationMode === "exact") {
                setValue("public_address", v, { shouldDirty: true })
              }
            }}
            onSelect={handleAddressSelect}
            onBlur={handleAddressBlur}
            placeholder="Ej. Calle 5, Casa 12, Escazú, San José"
          />
        </Field>

        {locationMode === "approximate" && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground rounded-lg bg-muted/40 px-3 py-2">
            <MapPinIcon className="h-3 w-3 shrink-0" />
            <span>Zona pública:</span>
            {approxGenerating ? (
              <span className="italic opacity-60">generando…</span>
            ) : approxAddress ? (
              <span className="font-medium text-foreground">{approxAddress}</span>
            ) : (
              <span className="italic opacity-60">se generará al ingresar la dirección</span>
            )}
          </div>
        )}
      </FormSection>

      {/* ─── § 4 — Amenidades ───────────────────────────────── */}
      <FormSection
        id="amenities"
        number={4}
        title={t("section4Title")}
        description={t("section4Desc")}
        optional
      >
        <AmenitiesPicker
          value={watch("amenities") ?? []}
          onChange={(next) =>
            setValue("amenities", next, { shouldDirty: true })
          }
          disabled={isSubmitting || readOnly}
        />
      </FormSection>

      {/* ─── § 5 — Descripción ──────────────────────────────── */}
      <FormSection
        id="description"
        number={5}
        title={t("section5Title")}
        description={t("section5Desc")}
      >
        <RichTextEditor
          value={watch("description") ?? ""}
          onChange={(html) => setValue("description", html, { shouldDirty: true })}
          aiRewrite={handleAiRewrite}
          placeholder={t("section5Placeholder")}
          disabled={readOnly}
        />
      </FormSection>

      {/* ─── § 6 — Asociaciones ─────────────────────────────── */}
      <FormSection
        id="associations"
        number={6}
        title={t("section6Title")}
        description={t("section6Desc")}
        optional
      >
        {projects.length > 0 && (() => {
          const uniqueProjects = Array.from(
            new Map(projects.map((p) => [p.id, p])).values(),
          )
          return (
            <Field label="Proyecto">
              <Select
                defaultValue={property?.project_id ?? "none"}
                onValueChange={(v) => setValue("project_id", !v || v === "none" ? null : v, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin proyecto">
                    {(v: unknown) =>
                      !v || v === "none"
                        ? "Sin proyecto"
                        : uniqueProjects.find((p) => p.id === v)?.title ?? "Sin proyecto"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin proyecto</SelectItem>
                  {uniqueProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex-1">{p.title}</span>
                      <span
                        className={cn(
                          "ml-2 shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                          p.is_master_template
                            ? "border-info/30 bg-info-soft text-info"
                            : "border-muted-foreground/20 bg-muted text-muted-foreground",
                        )}
                      >
                        {p.is_master_template ? "Plantilla" : "Personalizado"}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )
        })()}

        <OwnerSelector
          value={ownerId}
          onChange={(id) => {
            setOwnerId(id)
            setValue("owner_id", id, { shouldDirty: true })
          }}
          onOwnerSelect={onOwnerChange}
          initial={initialOwner}
        />
      </FormSection>

      {/* ── Inline actions (only when no external save button) ── */}
      {!hideActions && (
        <div className="flex items-center gap-3 pt-(--spacing-block)">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Guardando…" : mode === "create" ? "Crear propiedad" : "Guardar cambios"}
          </Button>
          {mode === "create" && (
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancelar
            </Button>
          )}
          {savedOk && (
            <span className="flex items-center gap-1.5 text-sm text-success font-medium">
              <CheckCircleIcon className="h-4 w-4" />
              Cambios guardados
            </span>
          )}
        </div>
      )}

      </fieldset>
    </form>
  )
}

// ── Small helpers ─────────────────────────────────────────────────
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
