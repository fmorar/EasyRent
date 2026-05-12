"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useTranslations } from "next-intl"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert } from "@/components/ui/alert"
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon,
  HomeIcon,
} from "@heroicons/react/24/outline"
import { EasyrentLogo } from "@/components/shared/easyrent-logo"
import { AuthFeatureShowcase } from "@/components/auth/auth-feature-showcase"

const loginSchema = z.object({
  email:    z.string().email("Ingresá un correo válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
})
type LoginForm = z.infer<typeof loginSchema>

interface Props {
  /** URL of the placeholder hero photo. Server picks this from the
   *  most recent marketplace cover; null falls back to a gradient. */
  heroImageUrl: string | null
}

/**
 * Split-screen login.
 *
 *   [ Hero photo + brand + tagline ]  [ White panel · form · social ]
 *
 * On mobile the hero collapses to a slim banner above the form so
 * the form is always above the fold.
 */
export function LoginClient({ heroImageUrl }: Props) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()
  const t            = useTranslations("auth")

  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema), mode: "onBlur" })

  // The middleware redirects unauthenticated visits to /login with
  // ?next=… . Honor it on success.
  const nextPath = searchParams.get("next") ?? "/dashboard"

  async function onSubmit(values: LoginForm) {
    setServerError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email:    values.email,
      password: values.password,
    })
    if (error) {
      setServerError(error.message)
      return
    }
    router.push(nextPath)
    router.refresh()
  }

  // `heroImageUrl` is no longer used — the right side is now the
  // animated feature showcase (`<AuthFeatureShowcase>`). We accept
  // the prop for backwards compatibility so callers don't break.
  void heroImageUrl

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* ── LEFT · form ────────────────────────────────────────── */}
      <main className="relative flex flex-col px-6 py-8 sm:px-10 sm:py-10 lg:px-16 lg:py-12 min-h-screen">
        {/* Top row: back-to-home + (mobile-only) brand */}
        <header className="flex items-center justify-between mb-(--spacing-block) lg:mb-(--spacing-section)">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            Volver al inicio
          </Link>
          {/* Mobile-only brand (the showcase aside is hidden < lg) */}
          <span className="lg:hidden flex items-center gap-2">
            <span className="h-7 w-7 rounded-full bg-foreground text-background flex items-center justify-center">
              <HomeIcon className="h-3.5 w-3.5" />
            </span>
            <EasyrentLogo className="h-3.5 w-auto text-foreground" />
          </span>
        </header>

        {/* The brand wordmark used to live here, but pulling it out
            of the centered cluster left it floating alone at the top
            and threw off the column's vertical balance. We now mount
            it INSIDE the centered flex-1 below so the brand, title,
            form and footer note are one balanced vertical group. */}

        <div className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto">
          {/* Brand wordmark — desktop only, lives INSIDE the centered
              cluster so brand, title, form and footer note share the
              same vertical group and the column balances around it. */}
          <div className="hidden lg:flex items-center gap-3 mb-(--spacing-section)">
            <span className="h-10 w-10 rounded-xl bg-foreground text-background flex items-center justify-center">
              <HomeIcon className="h-5 w-5" />
            </span>
            <EasyrentLogo className="h-5 w-auto text-foreground" />
          </div>

          <div className="space-y-(--spacing-tight) mb-(--spacing-block)">
            <h1 className="text-3xl sm:text-4xl font-heading font-bold tracking-tight">
              ¡Bienvenido de vuelta!
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("signInDescription")}
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
                placeholder={t("emailPlaceholder")}
                autoComplete="email"
                aria-invalid={errors.email ? "true" : "false"}
                className="h-11"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
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
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between text-xs">
              <Label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                <Checkbox className="h-3.5 w-3.5" />
                <span>Recordarme</span>
              </Label>
              <Link
                href="/login/forgot"
                className="text-foreground/70 hover:text-foreground hover:underline underline-offset-4"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full h-12 text-sm font-medium mt-(--spacing-tight)"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" aria-hidden />
                  Ingresando…
                </>
              ) : (
                "Iniciar sesión"
              )}
            </Button>
          </form>

          {/* Footer note — registration is invitation-only in this product */}
          <p className="mt-(--spacing-section) text-center text-xs text-muted-foreground">
            ¿Sos asesor invitado? Usá el link que te llegó por correo.
          </p>
        </div>
      </main>

      {/* ── RIGHT · animated feature showcase (hidden < lg) ─────── */}
      <aside
        className="relative hidden lg:block isolate overflow-hidden"
        aria-hidden
      >
        <AuthFeatureShowcase />
      </aside>
    </div>
  )
}
