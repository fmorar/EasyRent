"use client"

import { useState, useTransition } from "react"
import { useLocale } from "next-intl"
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

const INTENT_OPTIONS = [
  { value: "sale", label: "Vender mi propiedad" },
  { value: "rent", label: "Alquilar mi propiedad" },
  { value: "both", label: "Aún estoy decidiendo" },
] as const

const PROPERTY_TYPES = [
  { value: "apartment",  label: "Apartamento" },
  { value: "house",      label: "Casa" },
  { value: "land",       label: "Terreno" },
  { value: "commercial", label: "Local comercial" },
  { value: "office",     label: "Oficina" },
  { value: "warehouse",  label: "Bodega" },
] as const

const schema = z.object({
  full_name: z.string().min(2, "Escribí tu nombre completo."),
  email: z.union([z.literal(""), z.string().email("Revisá el formato del correo.")]).optional(),
  phone: z.string()
    .min(7, "Ingresá un teléfono donde te podamos contactar.")
    .max(40, "Revisá el formato del teléfono."),
  intent:        z.enum(["sale", "rent", "both"]),
  property_type: z.enum(["apartment", "house", "land", "commercial", "office", "warehouse"]).optional(),
  zone:          z.string().max(120).optional(),
  message:       z.string().max(2000).optional(),
})
type FormValues = z.infer<typeof schema>

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
  const [done,        setDone]    = useState(false)
  const [error,       setError]   = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

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

  function onSubmit(values: FormValues) {
    setError(null)
    startTransition(async () => {
      const result = await submitOwnerLead({
        full_name:      values.full_name,
        phone:          values.phone,
        email:          values.email || undefined,
        intent:         values.intent,
        property_type:  values.property_type,
        zone:           values.zone,
        message:        values.message,
        source_context: `Contacto · ${pathname.replace(/^\/(?:es|en)(?=\/|$)/, "") || "/contacto"}`,
        locale,
      })
      if (!result.success) {
        toast.error(result.error ?? "No pudimos enviar tu consulta. Probá de nuevo.")
        setError(result.error ?? null)
        return
      }
      toast.success("Listo. Te contactamos en menos de 24 horas.")
      setDone(true)
    })
  }

  if (done) {
    return (
      <div className="rounded-2xl border bg-success-soft p-(--spacing-block) space-y-(--spacing-tight)">
        <div className="flex items-center gap-2 text-success">
          <CheckCircleIcon className="h-5 w-5" />
          <p className="font-heading font-semibold text-base">¡Listo! Recibimos tu solicitud.</p>
        </div>
        <p className="text-sm text-foreground/80 leading-relaxed">
          Vamos a revisar la información de tu propiedad y te contactamos en menos
          de 24 horas para coordinar una valoración. Si querés adelantar, escribinos
          por WhatsApp.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-(--spacing-cluster)" noValidate>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Row 1 — name + phone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-(--spacing-cluster)">
        <Field id="full_name" label="Nombre" error={errors.full_name?.message}>
          <Input
            id="full_name"
            autoComplete="name"
            placeholder="María Castro"
            {...register("full_name")}
          />
        </Field>
        <Field id="phone" label="WhatsApp" error={errors.phone?.message}>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+506 0000 0000"
            {...register("phone")}
          />
        </Field>
      </div>

      {/* Row 2 — email + zone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-(--spacing-cluster)">
        <Field id="email" label="Correo (opcional)" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="maria@correo.com"
            {...register("email")}
          />
        </Field>
        <Field id="zone" label="Zona" error={errors.zone?.message}>
          <Input
            id="zone"
            placeholder="San Rafael de Escazú"
            {...register("zone")}
          />
        </Field>
      </div>

      {/* Row 3 — intent + property type (both selects, full width pair) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-(--spacing-cluster)">
        <Field id="intent" label="¿Qué querés hacer?" error={errors.intent?.message}>
          <Select
            value={intent}
            onValueChange={(v) => setValue("intent", v as FormValues["intent"], { shouldValidate: true })}
          >
            <SelectTrigger id="intent">
              <SelectValue>
                {INTENT_OPTIONS.find((o) => o.value === intent)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {INTENT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="property_type" label="Tipo de propiedad" error={errors.property_type?.message}>
          <Select
            value={propertyType ?? ""}
            onValueChange={(v) => setValue("property_type", v as FormValues["property_type"], { shouldValidate: true })}
          >
            <SelectTrigger id="property_type">
              <SelectValue placeholder="Seleccioná…">
                {propertyType
                  ? PROPERTY_TYPES.find((p) => p.value === propertyType)?.label
                  : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPES.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {/* Row 4 — message (full width) */}
      <Field id="message" label="Mensaje" error={errors.message?.message}>
        <Textarea
          id="message"
          rows={4}
          maxLength={2000}
          placeholder="Contanos detalles que sumen — área, habitaciones, condición, documentación, urgencia…"
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
          {pending ? "Enviando…" : "Solicitar valoración"}
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
