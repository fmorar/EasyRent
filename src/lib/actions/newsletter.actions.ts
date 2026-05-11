"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import type { ActionResult } from "@/types"

interface SubscribeInput {
  email:           string
  /** Where the visitor signed up from (e.g. "Footer · /", "Footer · /agents/sofia"). */
  source_context?: string
  /** "es" | "en" — falls back to "es" when not provided. */
  locale?:         string
}

/**
 * Capture a newsletter signup. Idempotent — submitting the same
 * email twice updates `subscribed_at` and clears any prior
 * `unsubscribed_at` (re-opt-in). Always returns `{ success: true }`
 * for valid inputs to avoid leaking which addresses are already
 * registered.
 */
export async function subscribeToNewsletter(
  input: SubscribeInput
): Promise<ActionResult<{ id: string }>> {
  const trimmed = input.email.trim()

  // Basic shape check — full validation happens at the form layer.
  if (!trimmed) return { success: false, error: "Falta el correo." }
  if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
    return { success: false, error: "Revisá el formato del correo." }
  }

  const admin  = createAdminClient()
  const locale = input.locale === "en" ? "en" : "es"

  // Upsert: if the email already exists, refresh `subscribed_at`
  // and clear `unsubscribed_at`. The table's UNIQUE constraint on
  // `email` is what makes the conflict targetable.
  const { data, error } = await admin
    .from("newsletter_subscribers")
    .upsert(
      {
        email:           trimmed,
        source_context:  input.source_context ?? null,
        locale,
        subscribed_at:   new Date().toISOString(),
        unsubscribed_at: null,
      },
      { onConflict: "email", ignoreDuplicates: false }
    )
    .select("id")
    .single()

  if (error) return { success: false, error: error.message }

  return { success: true, data: { id: data.id } }
}
