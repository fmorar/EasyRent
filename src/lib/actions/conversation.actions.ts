"use server"

import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth"
import { isAdminRole } from "@/lib/roles"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/supabase"

type ConversationStatus = Database["public"]["Enums"]["conversation_status"]

const VALID_STATUSES: readonly ConversationStatus[] = ["open", "pending", "closed"]

export interface SetStatusResult {
  success: boolean
  error?: string
  status?: ConversationStatus
}

/**
 * Toggle a conversation's status from the dashboard.
 *
 *   open    → bot replies normally.
 *   pending → bot is muted; webhook still persists inbound messages
 *             so the human can pick them up. Used when an agent takes
 *             over (handoff).
 *   closed  → archive state; bot stays muted and the row sinks out
 *             of the default "open" tab.
 *
 * Permission: the viewer must either be an admin OR the assigned
 * agent on the linked lead. We enforce both — the user-scoped
 * Supabase client (RLS) plus an explicit check on assigned_to.
 */
export async function setConversationStatus(
  conversationId: string,
  status:         ConversationStatus,
): Promise<SetStatusResult> {
  if (!VALID_STATUSES.includes(status)) {
    return { success: false, error: `Invalid status: ${status}` }
  }

  const { profile } = await requireAuth()
  const supabase    = await createClient()

  // Resolve the linked lead so we can run the assigned-to check.
  const convRes = await supabase
    .from("conversations")
    .select("id, lead_id, status, lead:leads(assigned_to)")
    .eq("id", conversationId)
    .maybeSingle()
  if (convRes.error || !convRes.data) {
    return { success: false, error: "Conversation not found." }
  }

  const isAdmin     = isAdminRole(profile.role)
  const leadAssigned = (convRes.data as { lead?: { assigned_to: string | null } | null })
    .lead?.assigned_to ?? null
  if (!isAdmin && leadAssigned !== profile.id) {
    return { success: false, error: "Not allowed to modify this conversation." }
  }

  const updateRes = await supabase
    .from("conversations")
    .update({ status })
    .eq("id", conversationId)
    .select("id, status")
    .single()

  if (updateRes.error || !updateRes.data) {
    return { success: false, error: updateRes.error?.message ?? "Update failed." }
  }

  // Revalidate both the list and the detail so the new badge appears
  // without a manual reload.
  revalidatePath("/conversations")
  revalidatePath(`/conversations/${conversationId}`)

  return { success: true, status: updateRes.data.status as ConversationStatus }
}
