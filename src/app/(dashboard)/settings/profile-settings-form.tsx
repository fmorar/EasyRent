"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useState } from "react"
import { updateProfile } from "@/lib/actions/auth.actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { Profile } from "@/types"

const profileSchema = z.object({
  full_name: z.string().min(2, "Enter your full name"),
  phone:     z.string().optional(),
  bio:       z.string().max(500).optional(),
})

type ProfileForm = z.infer<typeof profileSchema>

export default function ProfileSettingsForm({ profile }: { profile: Profile }) {
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile.full_name,
      phone:     profile.phone ?? "",
      bio:       profile.bio ?? "",
    },
  })

  async function onSubmit(values: ProfileForm) {
    setMessage(null)
    const result = await updateProfile(values)

    setMessage(
      result.success
        ? { type: "success", text: "Profile updated." }
        : { type: "error",   text: result.error }
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {message && (
        <Alert variant={message.type === "error" ? "destructive" : "default"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" {...register("full_name")} />
        {errors.full_name && <p className="text-sm text-destructive">{errors.full_name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" type="tel" placeholder="+1 (555) 000-0000" {...register("phone")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          placeholder="A short description about yourself..."
          rows={3}
          {...register("bio")}
        />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save changes"}
      </Button>
    </form>
  )
}
