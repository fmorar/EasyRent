"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert } from "@/components/ui/alert"
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline"

// Same min length as the login form (Supabase default minimum is 6).
// If you raise the project's password policy, raise this too.
const schema = z.object({
  password: z.string()
    .min(8, "Usá al menos 8 caracteres")
    .max(72, "La contraseña es demasiado larga"),
  confirm:  z.string(),
}).refine((v) => v.password === v.confirm, {
  path:    ["confirm"],
  message: "Las contraseñas no coinciden",
})
type Form = z.infer<typeof schema>

interface Props {
  /** The email of the user in the recovery session. Read-only display. */
  userEmail: string | null
}

/**
 * Reset-password form. Runs inside an active recovery session
 * (`/api/auth/callback` already exchanged the PKCE code and set the
 * session cookie). Submitting calls `auth.updateUser({ password })`
 * and pushes to `/dashboard`.
 */
export function ResetPasswordForm({ userEmail }: Props) {
  const supabase = createClient()
  const router   = useRouter()

  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema), mode: "onBlur" })

  async function onSubmit(values: Form) {
    setServerError(null)
    const { error } = await supabase.auth.updateUser({ password: values.password })
    if (error) {
      setServerError(error.message)
      return
    }
    // Password set — drop them on the dashboard.
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <>
      <div className="space-y-(--spacing-tight) mb-(--spacing-block)">
        <h1 className="text-3xl sm:text-4xl font-heading font-bold tracking-tight">
          Definí tu nueva contraseña
        </h1>
        <p className="text-sm text-muted-foreground">
          {userEmail ? (
            <>Cuenta: <span className="font-medium text-foreground">{userEmail}</span></>
          ) : (
            "Ingresá una contraseña nueva para tu cuenta."
          )}
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
          <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
            Nueva contraseña
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              autoFocus
              aria-invalid={errors.password ? "true" : "false"}
              className="h-11 pr-10"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              tabIndex={-1}
            >
              {showPassword
                ? <EyeSlashIcon className="h-4 w-4" />
                : <EyeIcon className="h-4 w-4" />}
            </button>
          </div>
          {errors.password ? (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Mínimo 8 caracteres. Mezclá letras y números para más seguridad.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm" className="text-xs font-medium text-muted-foreground">
            Confirmá la contraseña
          </Label>
          <Input
            id="confirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            aria-invalid={errors.confirm ? "true" : "false"}
            className="h-11"
            {...register("confirm")}
          />
          {errors.confirm && (
            <p className="text-xs text-destructive">{errors.confirm.message}</p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full h-12 text-sm font-medium"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? "Guardando…" : "Guardar contraseña"}
        </Button>
      </form>
    </>
  )
}
