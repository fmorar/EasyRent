"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import type { ActionResult } from "@/types"

export interface CustomZoneRow {
  code:  string
  label: string
}

/**
 * Build a stable, snake_cased code for a custom zone label.
 * Always prefixed with `custom__` so codes never collide with
 * the built-in CR taxonomy in `src/lib/zones.ts`.
 */
function customCode(label: string): string {
  const slug = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")  // strip accents
    .replace(/&/g, "y")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
  return `custom__${slug || "zone"}`
}

export async function listCustomZones(): Promise<ActionResult<CustomZoneRow[]>> {
  await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("custom_zones")
    .select("code, label")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })

  if (error) return { success: false, error: error.message }
  return { success: true, data: (data ?? []) as CustomZoneRow[] }
}

export async function createCustomZone(
  label: string,
): Promise<ActionResult<CustomZoneRow>> {
  const { profile } = await requireAuth()
  const trimmed = label.trim()

  if (!trimmed) {
    return { success: false, error: "El nombre de la zona no puede estar vacío" }
  }
  if (trimmed.length > 80) {
    return { success: false, error: "Máximo 80 caracteres" }
  }

  const supabase = await createClient()
  const code = customCode(trimmed)

  // Idempotent: if a zone with this code already exists, return it
  const { data: existing } = await supabase
    .from("custom_zones")
    .select("code, label")
    .eq("code", code)
    .is("deleted_at", null)
    .maybeSingle()

  if (existing) {
    return { success: true, data: existing as CustomZoneRow }
  }

  const { data, error } = await supabase
    .from("custom_zones")
    .insert({ code, label: trimmed, created_by: profile.id })
    .select("code, label")
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath("/settings")
  return { success: true, data: data as CustomZoneRow }
}
