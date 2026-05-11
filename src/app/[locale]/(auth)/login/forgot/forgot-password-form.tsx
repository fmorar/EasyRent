"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert } from "@/components/ui/alert"
import { CheckCircleIcon } from "@heroicons/react/24/outline"

const schema = z.object({
  email: z.string().email("Ingresá un correo válido"),
})
type Form = z.infer<typeof schema>

interface Props {
  /** Optional error surfaced from the auth callback (e.g. expired link). */
  initialError: string | null
}

/**
 * Forgot-password form.
 *
 *   1. User enters their email.
 *   2. We call `supabase.auth.resetPasswordForEmail` with a redirectTo
 *      pointing at the PKCE callback (`/api/auth/callback`) which
 *      will exchange the code and forward to `/login/reset`.
 *   3. We always show a success state — even when the email isn't on
 *      file — to avoid leaking which addresses are registered.
 */
export function ForgotPasswordForm({ initialError }: Props) {
  const supabase = createClient()
  const [serverError, setServerError] = useState<string | null>(initialError)
  const [sent,        setSent]        = useState(false)
  const [sentToEmail, setSentToEmail] = useState<string>("")

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema), mode: "onBlur" })

  async function onSubmit(values: Form) {
    setServerError(null)

    // The redirect URL is absolute (Supabase requires it). The
    // callback route handles the PKCE code exchange and forwards
    // to `/login/reset` after setting the session cookie.
    const origin     = window.location.origin
    const redirectTo = `${origin}/api/auth/callback?next=/login/reset`

    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo,
    })

    if (error) {
      setServerError(error.message)
      return
    }

    setSentToEmail(values.email)
    setSent(true)
  }

  // ── Success state ─────────────────────────────────────────────
  if (sent) {
    return (
      <div className="space-y-(--spacing-cluster)">
        <div className="space-y-(--spacing-tight)">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-success-soft text-success">
            <CheckCircleIcon className="h-5 w-5" />
          </span>
          <h1 className="text-3xl sm:text-4xl font-heading font-bold tracking-tight pt-(--spacing-tight)">
            Revisá tu correo
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Te enviamos un enlace a{" "}
            <span className="font-medium text-foreground">{sentToEmail}</span>
            {" "}para que restablezcas tu contraseña. El link es válido por 1 hora.
          </p>
        </div>

        <Alert>
          <p className="text-xs leading-relaxed">
            ¿No te llegó? Revisá la carpeta de spam o probá de nuevo en unos minutos. Por seguridad no te confirmamos si el correo está registrado.
          </p>
        </Alert>

        <div className="flex items-center justify-between pt-(--spacing-tight)">
          <Link
            href="/login"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Volver al inicio de sesión
          </Link>
          <button
            type="button"
            onClick={() => { setSent(false); setSentToEmail("") }}
            className="text-xs text-foreground/80 hover:text-foreground underline underline-offset-4 decoration-primary decoration-2"
          >
            Probar con otro correo
          </button>
        </div>
      </div>
    )
  }

  // ── Form state ────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-(--spacing-tight) mb-(--spacing-block)">
        <h1 className="text-3xl sm:text-4xl font-heading font-bold tracking-tight">
          ¿Olvidaste tu contraseña?
        </h1>
        <p className="text-sm text-muted-foreground">
          Ingresá tu correo y te enviamos un enlace para restablecerla.
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-(--spacing-cluster)"
        noValidate
      >
        {serverError && (
          <Alert variant="destructive">
            <p className="text-sm">{serverError}</p>
          </Alert>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
            Correo electrónico
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="tu@correo.com"
            autoComplete="email"
            autoFocus
            aria-invalid={errors.email ? "true" : "false"}
            className="h-11"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full h-12 text-sm font-medium"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? "Enviando…" : "Enviar enlace de recuperación"}
        </Button>

        <p className="text-center text-xs text-muted-foreground pt-(--spacing-tight)">
          ¿Te acordaste?{" "}
          <Link
            href="/login"
            className="text-foreground/90 hover:text-foreground underline underline-offset-4 decoration-primary decoration-2"
          >
            Volver al inicio de sesión
          </Link>
        </p>
      </form>
    </>
  )
}
