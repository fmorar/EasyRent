"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import type { Owner, ActionResult } from "@/types"

export interface OwnerFormInput {
  full_name: string
  phone?:    string | null
  email?:    string | null
  id_number?: string | null
  notes?:    string | null
}

export async function searchOwners(query: string): Promise<Owner[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("owners")
    .select("*")
    .is("deleted_at", null)
    .ilike("full_name", `%${query}%`)
    .order("full_name")
    .limit(20)

  return data ?? []
}

export async function listOwners(): Promise<Owner[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("owners")
    .select("*")
    .is("deleted_at", null)
    .order("full_name")

  return data ?? []
}

export async function getOwner(id: string): Promise<Owner | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("owners")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single()

  return data ?? null
}

export async function createOwner(
  input: OwnerFormInput
): Promise<ActionResult<Owner>> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  const { data, error } = await supabase
    .from("owners")
    .insert({
      full_name:  input.full_name.trim(),
      phone:      input.phone?.trim()    || null,
      email:      input.email?.trim()    || null,
      id_number:  input.id_number?.trim() || null,
      notes:      input.notes?.trim()    || null,
      created_by: profile.id,
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath("/properties")
  return { success: true, data }
}

export async function updateOwner(
  id:    string,
  input: Partial<OwnerFormInput>
): Promise<ActionResult<Owner>> {
  await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("owners")
    .update({
      full_name:  input.full_name?.trim(),
      phone:      input.phone?.trim()     ?? null,
      email:      input.email?.trim()     ?? null,
      id_number:  input.id_number?.trim() ?? null,
      notes:      input.notes?.trim()     ?? null,
    })
    .eq("id", id)
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath("/properties")
  return { success: true, data }
}

export async function deleteOwner(id: string): Promise<ActionResult> {
  await requireAuth()
  const supabase = await createClient()

  const { error } = await supabase
    .from("owners")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)

  if (error) return { success: false, error: error.message }

  revalidatePath("/properties")
  return { success: true, data: undefined }
}
