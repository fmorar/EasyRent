"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  EyeIcon,
  EyeSlashIcon,
  ShieldCheckIcon,
  ArrowRightOnRectangleIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FormSection } from "@/components/shared/form-section"
import type { Profile } from "@/types"

interface Props {
  profile: Profile
}

/**
 * Security settings — two blocks:
 *
 *   1. Change password
 *      - Verifies the current password by re-running
 *        `signInWithPassword({ email, currentPassword })`. Supabase
 *        doesn't ship a "verify password" RPC, so re-auth is the
 *        accepted pattern. On success we call
 *        `auth.updateUser({ password: new })`.
 *
 *   2. Sign out everywhere
 *      - Calls `auth.signOut({ scope: "global" })` which revokes all
 *        the user's refresh tokens across every device, then redirects
 *        to /login. Useful after a stolen-laptop scare.
 *
 * Both flows show in-place feedback (Alert) plus a toast on success.
 */
export default function SecuritySettingsForm({ profile }: Props) {
  const t        = useTranslations("settings")
  const locale   = useLocale()
  const supabase = createClient()
  const router   = useRouter()

  // Independent loading + message states so a failure in one
  // block doesn't visually wipe the other.
  const [pwMsg,    setPwMsg]    = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [emailMsg, setEmailMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [globalMsg,setGlobalMsg]= useState<{ type: "success" | "error"; text: string } | null>(null)
  const [signOutPending, setSignOutPending] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew,     setShowNew]     = useState(false)
  const [showEmailPw, setShowEmailPw] = useState(false)

  // ── Password schema ─────────────────────────────────────────────
  const schema = z.object({
    current: z.string().min(1, t("securityCurrentRequired")),
    next:    z.string()
      .min(8,  t("securityNewMin"))
      .max(72, t("securityNewMax")),
    confirm: z.string(),
  }).refine((v) => v.next === v.confirm, {
    path:    ["confirm"],
    message: t("securityNewMismatch"),
  }).refine((v) => v.next !== v.current, {
    path:    ["next"],
    message: t("securityNewSameAsCurrent"),
  })
  type FormValues = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode:     "onBlur",
  })

  async function onChangePassword(values: FormValues) {
    setPwMsg(null)

    // Step 1 — verify the current password by re-authenticating.
    const verify = await supabase.auth.signInWithPassword({
      email:    profile.email,
      password: values.current,
    })
    if (verify.error) {
      // Don't leak verify.error.message — Supabase returns "Invalid
      // login credentials" for wrong-password and we want a more
      // specific copy. Other errors (rate-limit, network) get the
      // raw message.
      const msg = verify.error.message?.toLowerCase().includes("invalid")
        ? t("securityCurrentWrong")
        : verify.error.message
      setPwMsg({ type: "error", text: msg ?? t("securityChangeFail") })
      return
    }

    // Step 2 — actually rotate the password.
    const update = await supabase.auth.updateUser({ password: values.next })
    if (update.error) {
      setPwMsg({ type: "error", text: update.error.message })
      return
    }

    setPwMsg({ type: "success", text: t("securityChangedOk") })
    toast.success(t("securityChangedOk"))
    reset()
  }

  // ── Email change ────────────────────────────────────────────────
  // Supabase requires the new email to be confirmed via a link sent
  // to it before auth.users.email actually flips. We re-auth with
  // current password first so a stolen session can't repoint the
  // account, then call updateUser({ email }). The migration
  // 20260513200000 wires an auth.users UPDATE trigger that mirrors
  // the new email onto profiles.email once the confirmation lands.
  const emailSchema = z.object({
    newEmail: z.string()
      .trim()
      .email(t("emailInvalid"))
      .refine((e) => e.toLowerCase() !== profile.email.toLowerCase(), {
        message: t("emailSameAsCurrent"),
      }),
    pw:       z.string().min(1, t("securityCurrentRequired")),
  })
  type EmailFormValues = z.infer<typeof emailSchema>

  const {
    register:           registerEmail,
    handleSubmit:       handleEmailSubmit,
    reset:              resetEmail,
    formState:          { errors: emailErrors, isSubmitting: emailSubmitting },
  } = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    mode:     "onBlur",
  })

  async function onChangeEmail(values: EmailFormValues) {
    setEmailMsg(null)

    // Re-auth — same pattern as password change.
    const verify = await supabase.auth.signInWithPassword({
      email:    profile.email,
      password: values.pw,
    })
    if (verify.error) {
      const msg = verify.error.message?.toLowerCase().includes("invalid")
        ? t("securityCurrentWrong")
        : verify.error.message
      setEmailMsg({ type: "error", text: msg ?? t("emailChangeFail") })
      return
    }

    // emailRedirectTo overrides Supabase's project-level Site URL for
    // the confirmation link target. Without this, dev environments
    // (or any project with a Site URL pointing to localhost) sent the
    // user a "verify" email pointing at localhost — broken outside
    // the developer's laptop. We use window.location.origin so each
    // environment redirects to itself: localhost in dev, the prod
    // domain on www.easyrent.house.
    const redirectTo = typeof window !== "undefined"
      ? `${window.location.origin}/${locale}/settings`
      : undefined
    const update = await supabase.auth.updateUser(
      { email: values.newEmail },
      redirectTo ? { emailRedirectTo: redirectTo } : undefined,
    )
    if (update.error) {
      setEmailMsg({ type: "error", text: update.error.message })
      return
    }

    setEmailMsg({
      type: "success",
      text: t("emailChangePending", { newEmail: values.newEmail }),
    })
    toast.success(t("emailChangePendingToast"))
    resetEmail()
  }

  async function onSignOutEverywhere() {
    setGlobalMsg(null)
    setSignOutPending(true)
    const { error } = await supabase.auth.signOut({ scope: "global" })
    if (error) {
      setGlobalMsg({ type: "error", text: error.message })
      setSignOutPending(false)
      return
    }
    toast.success(t("securityGlobalSignOutOk"))
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="space-y-(--spacing-block)">
      {/* ── Change email ─────────────────────────────────────── */}
      <FormSection
        id="email"
        number={1}
        title={t("emailTitle")}
        description={t("emailDesc")}
      >
        <form onSubmit={handleEmailSubmit(onChangeEmail)} className="space-y-(--spacing-cluster)" noValidate>
          {emailMsg && (
            <Alert variant={emailMsg.type === "error" ? "destructive" : "default"}>
              <AlertDescription>{emailMsg.text}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="currentEmail" className="text-xs font-medium text-muted-foreground">
              {t("emailCurrentLabel")}
            </Label>
            <Input
              id="currentEmail"
              type="email"
              value={profile.email}
              readOnly
              disabled
              className="h-11 bg-muted/40"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="newEmail" className="text-xs font-medium text-muted-foreground">
              {t("emailNewLabel")}
            </Label>
            <Input
              id="newEmail"
              type="email"
              autoComplete="email"
              placeholder="nombre@correo.com"
              aria-invalid={emailErrors.newEmail ? "true" : "false"}
              className="h-11"
              {...registerEmail("newEmail")}
            />
            {emailErrors.newEmail && (
              <p className="text-xs text-destructive">{emailErrors.newEmail.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emailPw" className="text-xs font-medium text-muted-foreground">
              {t("emailPwLabel")}
            </Label>
            <div className="relative">
              <Input
                id="emailPw"
                type={showEmailPw ? "text" : "password"}
                autoComplete="current-password"
                aria-invalid={emailErrors.pw ? "true" : "false"}
                className="h-11 pr-10"
                {...registerEmail("pw")}
              />
              <EyeToggle visible={showEmailPw} onToggle={() => setShowEmailPw((v) => !v)} />
            </div>
            {emailErrors.pw ? (
              <p className="text-xs text-destructive">{emailErrors.pw.message}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">{t("emailPwHint")}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={emailSubmitting}
            aria-busy={emailSubmitting}
            className="gap-2"
          >
            <EnvelopeIcon className="h-4 w-4" />
            {emailSubmitting ? t("emailChanging") : t("emailChangeCta")}
          </Button>
        </form>
      </FormSection>

      {/* ── Change password ──────────────────────────────────── */}
      <FormSection
        id="password"
        number={2}
        title={t("passwordTitle")}
        description={t("passwordDesc")}
      >
        <form onSubmit={handleSubmit(onChangePassword)} className="space-y-(--spacing-cluster)" noValidate>
          {pwMsg && (
            <Alert variant={pwMsg.type === "error" ? "destructive" : "default"}>
              <AlertDescription>{pwMsg.text}</AlertDescription>
            </Alert>
          )}

          {/* Hidden username field for password managers — without
              this, browsers can't associate the form with the account
              and won't offer to update saved credentials. */}
          <input
            type="email"
            name="email"
            value={profile.email}
            autoComplete="username"
            readOnly
            hidden
          />

          {/* Current password */}
          <div className="space-y-1.5">
            <Label htmlFor="current" className="text-xs font-medium text-muted-foreground">
              {t("securityCurrentLabel")}
            </Label>
            <div className="relative">
              <Input
                id="current"
                type={showCurrent ? "text" : "password"}
                autoComplete="current-password"
                aria-invalid={errors.current ? "true" : "false"}
                className="h-11 pr-10"
                {...register("current")}
              />
              <EyeToggle visible={showCurrent} onToggle={() => setShowCurrent((v) => !v)} />
            </div>
            {errors.current && (
              <p className="text-xs text-destructive">{errors.current.message}</p>
            )}
          </div>

          {/* New password */}
          <div className="space-y-1.5">
            <Label htmlFor="next" className="text-xs font-medium text-muted-foreground">
              {t("securityNewLabel")}
            </Label>
            <div className="relative">
              <Input
                id="next"
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                aria-invalid={errors.next ? "true" : "false"}
                className="h-11 pr-10"
                {...register("next")}
              />
              <EyeToggle visible={showNew} onToggle={() => setShowNew((v) => !v)} />
            </div>
            {errors.next ? (
              <p className="text-xs text-destructive">{errors.next.message}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {t("securityNewHint")}
              </p>
            )}
          </div>

          {/* Confirm */}
          <div className="space-y-1.5">
            <Label htmlFor="confirm" className="text-xs font-medium text-muted-foreground">
              {t("securityConfirmLabel")}
            </Label>
            <Input
              id="confirm"
              type={showNew ? "text" : "password"}
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
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="gap-2"
          >
            <ShieldCheckIcon className="h-4 w-4" />
            {isSubmitting ? t("securityChanging") : t("securityChangeCta")}
          </Button>
        </form>
      </FormSection>

      {/* ── Sign out everywhere ──────────────────────────────── */}
      <FormSection
        id="global-signout"
        number={3}
        title={t("securityGlobalTitle")}
        description={t("securityGlobalDesc")}
      >
        <div className="space-y-(--spacing-cluster)">
          {globalMsg && (
            <Alert variant={globalMsg.type === "error" ? "destructive" : "default"}>
              <AlertDescription>{globalMsg.text}</AlertDescription>
            </Alert>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={onSignOutEverywhere}
            disabled={signOutPending}
            aria-busy={signOutPending}
            className="gap-2"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4" />
            {signOutPending ? t("securityGlobalSigning") : t("securityGlobalCta")}
          </Button>
        </div>
      </FormSection>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────
function EyeToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
      aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
    >
      {visible
        ? <EyeSlashIcon className="h-4 w-4" />
        : <EyeIcon className="h-4 w-4" />}
    </button>
  )
}
