"use client"

import { useState, useTransition } from "react"
import { useLocale, useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  CheckCircleIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline"
import { submitOwnerLead } from "@/lib/actions/owner-lead.actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CountryCodeSelect } from "@/components/shared/country-code-select"

// Property type enum values — labels resolved from the shared
// `properties.types` namespace at render. Keeps the type label in
// lockstep with the rest of the site (marketplace chips, schema, etc.)
const PROPERTY_TYPE_VALUES = ["apartment", "house", "land", "commercial", "office", "warehouse"] as const
type PropertyTypeValue = (typeof PROPERTY_TYPE_VALUES)[number]

const INTENT_VALUES = ["sale", "rent", "both"] as const
type IntentValue = (typeof INTENT_VALUES)[number]

/**
 * Owner-intake form — compact 2-col layout matching the contact-page
 * design. Captures the essentials (contact + intent + property type +
 * zone) and a free-form message. We intentionally drop bedroom /
 * bathroom / area / asking-price from the form: those come up
 * naturally in the 24-hour follow-up call, and asking for them up
 * front raises the friction without much triage value.
 */
export function OwnerLeadForm() {
  const locale    = useLocale()
  const pathname  = usePathname()
  const t         = useTranslations("contactOwner.form")
  const tTypes    = useTranslations("properties.types")
  const [done,        setDone]    = useState(false)
  const [error,       setError]   = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  // Country dial code lives outside RHF — we concat it with the phone
  // input on submit. Default to Costa Rica since that's where the
  // platform operates.
  const [dialCode, setDialCode] = useState("+506")

  // Schema lives inside the component so zod error messages can come
  // from i18n — moving it outside would freeze them at module-load.
  const schema = z.object({
    full_name: z.string().min(2, t("nameRequired")),
    email: z.union([z.literal(""), z.string().email(t("emailInvalid"))]).optional(),
    phone: z.string()
      .min(7, t("phoneMin"))
      .max(40, t("phoneMax")),
    intent:        z.enum(INTENT_VALUES),
    property_type: z.enum(PROPERTY_TYPE_VALUES).optional(),
    zone:          z.string().max(120).optional(),
    message:       z.string().max(2000).optional(),
  })
  type FormValues = z.infer<typeof schema>

  // Build option arrays from i18n. The shared `properties.types`
  // namespace owns the type labels site-wide — reusing it here
  // keeps the dropdown in lockstep with the marketplace chips and
  // schema labels.
  const intentOptions: Array<{ value: IntentValue; label: string }> = [
    { value: "sale", label: t("intentSale") },
    { value: "rent", label: t("intentRent") },
    { value: "both", label: t("intentBoth") },
  ]
  const propertyTypeOptions: Array<{ value: PropertyTypeValue; label: string }> =
    PROPERTY_TYPE_VALUES.map((v) => ({ value: v, label: tTypes(v) }))

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { intent: "sale" },
  })

  const intent       = watch("intent")
  const propertyType = watch("property_type")

  /** Compose the final phone with the chosen country code. If the
   *  user already typed a "+", we trust their input as-is — they
   *  probably know what they're doing. */
  function composedPhone(raw: string): string {
    const trimmed = raw.trim()
    if (!trimmed) return ""
    if (trimmed.startsWith("+")) return trimmed
    return `${dialCode} ${trimmed}`.trim()
  }

  function onSubmit(values: FormValues) {
    setError(null)
    startTransition(async () => {
      const result = await submitOwnerLead({
        full_name:      values.full_name,
        phone:          composedPhone(values.phone),
        email:          values.email || undefined,
        intent:         values.intent,
        property_type:  values.property_type,
        zone:           values.zone,
        message:        values.message,
        source_context: `Contacto · ${pathname.replace(/^\/(?:es|en)(?=\/|$)/, "") || "/contacto"}`,
        locale,
      })
      if (!result.success) {
        toast.error(result.error ?? t("errorGeneric"))
        setError(result.error ?? null)
        return
      }
      toast.success(t("toastSuccess"))
      setDone(true)
    })
  }

  if (done) {
    return (
      <div className="rounded-2xl border bg-success-soft p-(--spacing-block) space-y-(--spacing-tight)">
        <div className="flex items-center gap-2 text-success">
          <CheckCircleIcon className="h-5 w-5" />
          <p className="font-heading font-semibold text-base">{t("successHeadline")}</p>
        </div>
        <p className="text-sm text-foreground/80 leading-relaxed">
          {t("successBody")}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-(--spacing-block)" noValidate>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Row 1 — name + phone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-(--spacing-cluster)">
        <Field id="full_name" label={t("nameLabel")} error={errors.full_name?.message}>
          <Input
            id="full_name"
            autoComplete="name"
            placeholder={t("namePlaceholder")}
            {...register("full_name")}
          />
        </Field>
        <Field id="phone" label={t("phoneLabel")} error={errors.phone?.message}>
          {/* Two-control input: a searchable country-code combobox
              on the left + a digits-only text input on the right.
              We compose them at submit time so the schema still
              sees one `phone` string. */}
          <div className="flex items-stretch gap-1.5">
            <CountryCodeSelect
              value={dialCode}
              onChange={(d) => setDialCode(d)}
              disabled={pending}
            />
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder={t("phonePlaceholder")}
              className="flex-1 min-w-0"
              {...register("phone")}
            />
          </div>
        </Field>
      </div>

      {/* Row 2 — email + zone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-(--spacing-cluster)">
        <Field id="email" label={t("emailLabel")} error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            {...register("email")}
          />
        </Field>
        <Field id="zone" label={t("zoneLabel")} error={errors.zone?.message}>
          <Input
            id="zone"
            placeholder={t("zonePlaceholder")}
            {...register("zone")}
          />
        </Field>
      </div>

      {/* Row 3 — intent + property type (both selects, full width pair) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-(--spacing-cluster)">
        <Field id="intent" label={t("intentLabel")} error={errors.intent?.message}>
          <Select
            value={intent}
            onValueChange={(v) => setValue("intent", v as FormValues["intent"], { shouldValidate: true })}
          >
            <SelectTrigger id="intent">
              <SelectValue>
                {intentOptions.find((o) => o.value === intent)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {intentOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="property_type" label={t("propertyTypeLabel")} error={errors.property_type?.message}>
          <Select
            value={propertyType ?? ""}
            onValueChange={(v) => setValue("property_type", v as FormValues["property_type"], { shouldValidate: true })}
          >
            <SelectTrigger id="property_type">
              <SelectValue placeholder={t("propertyTypePlaceholder")}>
                {propertyType
                  ? propertyTypeOptions.find((p) => p.value === propertyType)?.label
                  : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {propertyTypeOptions.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {/* Row 4 — message (full width) */}
      <Field id="message" label={t("messageLabel")} error={errors.message?.message}>
        <Textarea
          id="message"
          rows={4}
          maxLength={2000}
          placeholder={t("messagePlaceholder")}
          {...register("message")}
        />
      </Field>

      {/* CTA — right-aligned primary pill, matches the reference */}
      <div className="flex justify-end pt-(--spacing-tight)">
        <Button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="gap-2 h-11 px-6 rounded-full"
        >
          {pending ? t("submitSending") : t("submitDefault")}
          {!pending && <ArrowRightIcon className="h-4 w-4" />}
        </Button>
      </div>
    </form>
  )
}

// ── Field helper ─────────────────────────────────────────────────
function Field({
  id, label, error, children,
}: {
  id:       string
  label:    string
  error?:   string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
