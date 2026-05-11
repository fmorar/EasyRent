"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { acceptInvitation } from "@/lib/actions/invitation.actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

const acceptSchema = z
  .object({
    full_name:        z.string().min(2, "Enter your full name"),
    password:         z.string().min(8, "Password must be at least 8 characters"),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords don't match",
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

export default function AcceptInviteForm({
  invitation,
  token,
}: {
  invitation: Invitation
  token:      string
}) {
  const router       = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AcceptForm>({ resolver: zodResolver(acceptSchema) })

  async function onSubmit(values: AcceptForm) {
    setServerError(null)

    const result = await acceptInvitation({
      token,
      full_name: values.full_name,
      password:  values.password,
    })

    if (!result.success) {
      setServerError(result.error)
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accept invitation</CardTitle>
        <CardDescription>
          You&apos;ve been invited as <strong>{invitation.role}</strong>. Set up your account to get started.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={invitation.email} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" placeholder="Jane Smith" {...register("full_name")} />
            {errors.full_name && (
              <p className="text-sm text-destructive">{errors.full_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirm password</Label>
            <Input id="confirm_password" type="password" autoComplete="new-password" {...register("confirm_password")} />
            {errors.confirm_password && (
              <p className="text-sm text-destructive">{errors.confirm_password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
