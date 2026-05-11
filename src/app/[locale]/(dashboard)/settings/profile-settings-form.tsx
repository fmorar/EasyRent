"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { updateProfile } from "@/lib/actions/auth.actions"
import { listCustomZones, createCustomZone, type CustomZoneRow } from "@/lib/actions/zones.actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FormSection } from "@/components/shared/form-section"
import { ZonesPicker } from "@/components/shared/zones-picker"
import { AvatarUploader } from "@/components/agent/avatar-uploader"
import { CoverUploader } from "@/components/agent/cover-uploader"
import type { Profile } from "@/types"

export default function ProfileSettingsForm({ profile }: { profile: Profile }) {
  const t = useTranslations("settings")
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Defined inside the component so we can use the translator for error messages.
  const profileSchema = z.object({
    full_name: z.string().min(2, t("fullNameRequired")),
    phone:     z.string().optional(),
    bio:       z.string().max(500).optional(),
    zones:     z.array(z.string()),
  })

  type ProfileForm = z.infer<typeof profileSchema>

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile.full_name,
      phone:     profile.phone ?? "",
      bio:       profile.bio ?? "",
      zones:     (profile.zones ?? []) as string[],
    },
  })

  const zones = watch("zones") ?? []

  // ── Custom zones — lazy-load on mount ──────────────────────
  const [customZones, setCustomZones] = useState<CustomZoneRow[]>([])

  useEffect(() => {
    listCustomZones().then((res) => {
      if (res.success) setCustomZones(res.data)
    })
  }, [])

  async function handleCreateCustomZone(label: string) {
    const res = await createCustomZone(label)
    if (!res.success) {
      toast.error(res.error ?? "No se pudo crear la zona")
      return
    }
    // Optimistically add + auto-select the new zone
    setCustomZones((prev) =>
      prev.find((z) => z.code === res.data.code)
        ? prev
        : [...prev, res.data],
    )
    if (!zones.includes(res.data.code)) {
      setValue("zones", [...zones, res.data.code], { shouldDirty: true })
    }
    toast.success(`Zona "${res.data.label}" creada`)
  }

  async function onSubmit(values: ProfileForm) {
    setMessage(null)
    const result = await updateProfile(values)

    setMessage(
      result.success
        ? { type: "success", text: t("savedSuccess") }
        : { type: "error",   text: result.error }
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {message && (
        <Alert variant={message.type === "error" ? "destructive" : "default"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <FormSection
        id="public-profile"
        number={1}
        title={t("publicProfileTitle")}
        description={
          <>
            {t("publicProfileDescPrefix")}{" "}
            <code className="text-[11px] bg-muted px-1 rounded">
              /agents/{profile.slug}
            </code>
          </>
        }
      >
        {/* Avatar — uploads directly to the `avatars` bucket and
            persists `profile.avatar_url` on its own server action.
            Lives outside the main form because the rest of the
            fields are managed by react-hook-form, but the avatar
            saves immediately on change. */}
        <Field label="Foto de portada" hint="Banner del perfil público. Si no la subís, mostramos un fondo difuso de tu foto">
          <CoverUploader
            userId={profile.id}
            coverUrl={profile.cover_url}
          />
        </Field>

        <Field label="Foto de perfil" hint="Visible en tu perfil público y en cada propiedad que publicás">
          <AvatarUploader
            userId={profile.id}
            fullName={profile.full_name}
            avatarUrl={profile.avatar_url}
          />
        </Field>

        <Field label={t("fullNameLabel")} required error={errors.full_name?.message}>
          <Input id="full_name" {...register("full_name")} />
        </Field>

        <Field label={t("phoneLabel")}>
          <Input
            id="phone"
            type="tel"
            placeholder={t("phonePlaceholder")}
            {...register("phone")}
          />
        </Field>

        <Field label={t("bioLabel")} hint={t("bioHint")}>
          <Textarea
            id="bio"
            placeholder={t("bioPlaceholder")}
            rows={3}
            {...register("bio")}
          />
        </Field>
      </FormSection>

      <FormSection
        id="zones"
        number={2}
        title={t("zonesTitle")}
        description={t("zonesDesc")}
      >
        <ZonesPicker
          value={zones}
          onChange={(next) => setValue("zones", next, { shouldDirty: true })}
          customZones={customZones}
          onCreateCustomZone={handleCreateCustomZone}
          disabled={isSubmitting}
        />
      </FormSection>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? t("saving") : t("saveChanges")}
        </Button>
      </div>
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
    <div className="space-y-1">
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
