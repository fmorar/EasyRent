"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline"
import { acceptInvitation } from "@/lib/actions/invitation.actions"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

/**
 * Password policy: at least 8 chars with a mix of letters and numbers.
 * The strength meter below treats this minimum as "Débil" — anything
 * above is Medio/Seguro. Keeps the bar honest so users with the bare
 * minimum still see they should add more.
 */
const acceptSchema = z
  .object({
    full_name:        z.string().trim().min(2, "Escribí tu nombre completo"),
    password:         z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Za-z]/, "Debe incluir al menos una letra")
      .regex(/[0-9]/, "Debe incluir al menos un número"),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Las contraseñas no coinciden",
    path:    ["confirm_password"],
  })

type AcceptForm = z.infer<typeof acceptSchema>

interface Invitation {
  id:         string
  email:      string
  role:       string
  status:     string
  expires_at: string
}

// ── Strength scoring ─────────────────────────────────────────────
// Returns 0 (empty) / 1 (Débil) / 2 (Medio) / 3 (Seguro). Pure rules
// so we don't pull a 100kb dep like zxcvbn for what's essentially
// "did the user try a bit harder than the minimum".
function scorePassword(pwd: string): 0 | 1 | 2 | 3 {
  if (!pwd) return 0
  let classes = 0
  if (/[a-z]/.test(pwd))         classes++
  if (/[A-Z]/.test(pwd))         classes++
  if (/[0-9]/.test(pwd))         classes++
  if (/[^A-Za-z0-9]/.test(pwd))  classes++

  if (pwd.length < 8)                          return 1
  if (pwd.length >= 12 && classes >= 3)        return 3
  if (pwd.length >= 10 && classes >= 2)        return 3
  if (pwd.length >= 8 && classes >= 2)         return 2
  return 1
}

const STRENGTH_META = {
  0: { label: "",        bars: 0, color: "" },
  1: { label: "Débil",   bars: 1, color: "bg-destructive" },
  2: { label: "Medio",   bars: 2, color: "bg-warning"     },
  3: { label: "Seguro",  bars: 3, color: "bg-success"     },
} as const

export default function AcceptInviteForm({
  invitation,
  token,
}: {
  invitation: Invitation
  token:      string
}) {
  const router       = useRouter()
  const supabase     = createClient()
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPwd,     setShowPwd]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  // "idle"   → form interactive
  // "creating" → calling acceptInvitation (DB user + profile)
  // "signing-in" → calling signInWithPassword
  // The button stays disabled during the last two so we don't double-submit.
  const [stage, setStage] = useState<"idle" | "creating" | "signing-in">("idle")

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AcceptForm>({
    resolver: zodResolver(acceptSchema),
    mode:     "onChange",          // live validation for the match + strength UX
  })

  const busy = stage !== "idle"

  const password        = watch("password")        ?? ""
  const confirmPassword = watch("confirm_password") ?? ""
  const strength        = scorePassword(password)
  const strengthMeta    = STRENGTH_META[strength]
  const passwordsMatch  = confirmPassword.length > 0 && password === confirmPassword

  const roleLabel = invitation.role === "super_admin"
    ? "Super admin"
    : invitation.role === "owner_admin"
      ? "Administrador/a"
      : "Agente"

  async function onSubmit(values: AcceptForm) {
    setServerError(null)

    // 1) Create the account on the server (DB user + profile via trigger).
    setStage("creating")
    const result = await acceptInvitation({
      token,
      full_name: values.full_name,
      password:  values.password,
    })

    if (!result.success) {
      setServerError(result.error)
      setStage("idle")
      return
    }

    // 2) Auto-login so the user lands directly on the dashboard. If sign-in
    //    fails for any reason (rare — account exists but session creation
    //    bombed) we surface the error and let them go through /login.
    setStage("signing-in")
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email:    invitation.email,
      password: values.password,
    })

    if (signInError) {
      setServerError(
        "Tu cuenta se creó pero no pudimos iniciar sesión automáticamente. " +
        "Probá ingresar con tu correo y contraseña en la pantalla de login.",
      )
      setStage("idle")
      router.push("/login")
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aceptar invitación</CardTitle>
        <CardDescription>
          Te invitaron como <strong>{roleLabel}</strong>. Creá tu contraseña para
          entrar a la plataforma.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-(--spacing-cluster)"
          noValidate
        >
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label>Correo electrónico</Label>
            <Input value={invitation.email} disabled />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="full_name">Nombre completo</Label>
            <Input
              id="full_name"
              placeholder="Ana Mora"
              disabled={busy}
              aria-invalid={errors.full_name ? "true" : "false"}
              {...register("full_name")}
            />
            {errors.full_name && (
              <p className="text-xs text-destructive">{errors.full_name.message}</p>
            )}
          </div>

          {/* ── Password + show/hide + strength meter ────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPwd ? "text" : "password"}
                autoComplete="new-password"
                disabled={busy}
                aria-invalid={errors.password ? "true" : "false"}
                className="pr-10"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                tabIndex={-1}
                aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPwd
                  ? <EyeSlashIcon className="h-4 w-4" />
                  : <EyeIcon      className="h-4 w-4" />}
              </button>
            </div>

            {/* Strength meter — 3 segments that light up by score */}
            {password.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 flex gap-1">
                  {[1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1 flex-1 rounded-full transition-colors",
                        i <= strengthMeta.bars ? strengthMeta.color : "bg-muted",
                      )}
                    />
                  ))}
                </div>
                <span
                  className={cn(
                    "text-[11px] font-medium tabular-nums w-14 text-right",
                    strength === 1 && "text-destructive",
                    strength === 2 && "text-warning",
                    strength === 3 && "text-success",
                  )}
                >
                  {strengthMeta.label}
                </span>
              </div>
            )}

            {errors.password ? (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Mínimo 8 caracteres, con al menos una letra y un número.
              </p>
            )}
          </div>

          {/* ── Confirm password + show/hide + live match indicator ─ */}
          <div className="space-y-1.5">
            <Label htmlFor="confirm_password">Confirmar contraseña</Label>
            <div className="relative">
              <Input
                id="confirm_password"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                disabled={busy}
                aria-invalid={errors.confirm_password ? "true" : "false"}
                className="pr-10"
                {...register("confirm_password")}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                tabIndex={-1}
                aria-label={showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirm
                  ? <EyeSlashIcon className="h-4 w-4" />
                  : <EyeIcon      className="h-4 w-4" />}
              </button>
            </div>

            {confirmPassword.length > 0 && (
              passwordsMatch ? (
                <p className="text-xs text-success flex items-center gap-1">
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  Las contraseñas coinciden
                </p>
              ) : (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <XCircleIcon className="h-3.5 w-3.5" />
                  Las contraseñas no coinciden
                </p>
              )
            )}
          </div>

          <Button
            type="submit"
            className="w-full mt-(--spacing-block)"
            disabled={busy}
            aria-busy={busy}
          >
            {stage === "creating" && (
              <>
                <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" aria-hidden />
                Creando cuenta…
              </>
            )}
            {stage === "signing-in" && (
              <>
                <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" aria-hidden />
                Iniciando sesión…
              </>
            )}
            {stage === "idle" && "Crear cuenta"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
