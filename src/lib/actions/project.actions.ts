"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { slugify } from "@/lib/utils"
import { nanoid } from "nanoid"
import type { ActionResult, Project, ProjectInsert, ProjectUpdate } from "@/types"

type ProjectFormInput = {
  title:               string
  description?:        string
  developer_name?:     string
  location_label?:     string
  total_units?:        number | null
  available_units?:    number | null
  completion_date?:    string | null
  status?:             ProjectInsert["status"]
  /** Only honored when the caller is an owner_admin. Silently ignored otherwise. */
  is_master_template?: boolean
  is_public?:          boolean
  google_place_id?:    string | null
}

export async function createProject(
  input: ProjectFormInput
): Promise<ActionResult<Project>> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  const slug = `${slugify(input.title)}-${nanoid(6)}`

  // Only admins can create master templates. For agents the flag is forced to false
  // (RLS would also reject it, but we filter early to give a clean response).
  const isAdmin = profile.role === "owner_admin"

  const { data, error } = await supabase
    .from("projects")
    .insert({
      created_by:         profile.id,
      title:              input.title,
      slug,
      description:        input.description ?? null,
      developer_name:     input.developer_name ?? null,
      location_label:     input.location_label ?? null,
      total_units:        input.total_units ?? null,
      available_units:    input.available_units ?? null,
      completion_date:    input.completion_date ?? null,
      status:             input.status ?? "under_construction",
      is_master_template: isAdmin ? input.is_master_template === true : false,
      is_public:          input.is_public === true,
      google_place_id:    input.google_place_id ?? null,
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath("/projects")
  return { success: true, data }
}

// Fork a project the current user has access to — creates a copy they own.
// Allowed sources: master templates (visible to all) or forks shared with me.
// Nested forks ARE allowed: forking a fork creates a new fork with
// forked_from = source.id (chain).
//
// Inherits the source's amenities + photos so the new fork lands with
// the same content the user was looking at, ready to publish. Photos
// are inherited by URL reference (same storage objects) — the fork
// doesn't get its own copies until the agent uploads new ones, which
// is the cheap+correct semantics for shared/template inventory.
export async function forkProject(
  sourceId: string
): Promise<ActionResult<Project>> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  // RLS will restrict this read to projects the user can see.
  const { data: source, error: sourceError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", sourceId)
    .is("deleted_at", null)
    .single()

  if (sourceError || !source) {
    return { success: false, error: "Project not found or not accessible" }
  }

  const slug = `${slugify(source.title)}-fork-${nanoid(6)}`

  const { data, error } = await supabase
    .from("projects")
    .insert({
      created_by:         profile.id,
      title:              source.title,
      slug,
      description:        source.description,
      developer_name:     source.developer_name,
      location_label:     source.location_label,
      total_units:        source.total_units,
      available_units:    source.available_units,
      completion_date:    source.completion_date,
      status:             source.status,
      is_master_template: false,
      forked_from:        sourceId,
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  // ── Inherit amenities + photos in parallel ─────────────────────
  // Failures here don't fail the fork — the project row already
  // exists, and the user can re-upload / re-add anything that
  // didn't copy. We log so the issue surfaces.
  const [amenitiesRes, photosRes] = await Promise.all([
    supabase
      .from("project_amenities")
      .select("name, icon, sort_order")
      .eq("project_id", sourceId),

    supabase
      .from("project_photos")
      .select("url, storage_path, type, is_cover, order_index, caption")
      .eq("project_id", sourceId),
  ])

  const amenityRows = (amenitiesRes.data ?? []).map((a) => ({
    project_id: data.id,
    name:       a.name,
    icon:       a.icon,
    sort_order: a.sort_order,
  }))
  if (amenityRows.length > 0) {
    const { error: amErr } = await supabase
      .from("project_amenities")
      .insert(amenityRows)
    if (amErr) console.error("[forkProject] failed to copy amenities:", amErr)
  }

  const photoRows = (photosRes.data ?? []).map((p) => ({
    project_id:   data.id,
    url:          p.url,
    storage_path: p.storage_path,
    type:         p.type,
    is_cover:     p.is_cover,
    order_index:  p.order_index,
    caption:      p.caption,
  }))
  if (photoRows.length > 0) {
    const { error: phErr } = await supabase
      .from("project_photos")
      .insert(photoRows)
    if (phErr) console.error("[forkProject] failed to copy photos:", phErr)
  }

  revalidatePath("/projects")
  return { success: true, data }
}

// ── Sharing ───────────────────────────────────────────────────

export type NetworkAgent = {
  id:        string
  full_name: string
  email:     string | null
  relation:  "upline" | "downline"
}

// List the current user's 1-hop network: their inviter (upline) plus the
// agents they invited directly (downline). Excludes anyone in the upstream
// fork chain of `forProjectId` so the UI can grey them out.
export async function listMyNetworkForProject(
  forProjectId: string,
): Promise<ActionResult<NetworkAgent[]>> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()

  // Fetch my profile to get my upline
  const { data: me } = await supabase
    .from("profiles")
    .select("invited_by")
    .eq("id", profile.id)
    .single()

  // Downline: profiles I invited
  const { data: downline } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("invited_by", profile.id)
    .is("deleted_at", null)

  // Upline: the profile that invited me
  const { data: upline } = me?.invited_by
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", me.invited_by)
        .is("deleted_at", null)
        .maybeSingle()
        .then((r) => ({ data: r.data ? [r.data] : [] }))
    : { data: [] as { id: string; full_name: string; email: string | null }[] }

  const network: NetworkAgent[] = [
    ...(upline   ?? []).map((p) => ({ ...p, relation: "upline"   as const })),
    ...(downline ?? []).map((p) => ({ ...p, relation: "downline" as const })),
  ]

  // Filter out anyone in the upstream fork chain — they cannot receive shares
  // for this project. We use the SQL helper via rpc.
  if (network.length === 0) return { success: true, data: [] }

  const filtered: NetworkAgent[] = []
  for (const agent of network) {
    const { data: isAncestor } = await supabase.rpc("is_ancestor_creator", {
      p_project_id: forProjectId,
      candidate:    agent.id,
    })
    if (!isAncestor) filtered.push(agent)
  }

  return { success: true, data: filtered }
}

// Share a project with another agent. RLS enforces all the rules.
export async function shareProjectWith(
  projectId: string,
  agentId:   string,
): Promise<ActionResult> {
  await requireAuth()
  const supabase = await createClient()

  const { error } = await supabase
    .from("project_shares")
    .insert({ project_id: projectId, shared_with: agentId })

  if (error) return { success: false, error: error.message }

  revalidatePath("/projects")
  revalidatePath(`/projects/${projectId}`)
  return { success: true, data: undefined }
}

export async function unshareProjectWith(
  projectId: string,
  agentId:   string,
): Promise<ActionResult> {
  await requireAuth()
  const supabase = await createClient()

  const { error } = await supabase
    .from("project_shares")
    .delete()
    .eq("project_id", projectId)
    .eq("shared_with", agentId)

  if (error) return { success: false, error: error.message }

  revalidatePath("/projects")
  revalidatePath(`/projects/${projectId}`)
  return { success: true, data: undefined }
}

// Returns the agent IDs already granted access to this project.
export async function listProjectShares(
  projectId: string,
): Promise<ActionResult<string[]>> {
  await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("project_shares")
    .select("shared_with")
    .eq("project_id", projectId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: (data ?? []).map((r) => r.shared_with) }
}

export async function updateProject(
  id:    string,
  input: Partial<ProjectFormInput>
): Promise<ActionResult<Project>> {
  const { profile } = await requireAuth()
  const supabase    = await createClient()
  const isAdmin     = profile.role === "owner_admin"

  const update: ProjectUpdate = {
    title:           input.title,
    description:     input.description ?? null,
    developer_name:  input.developer_name ?? null,
    location_label:  input.location_label ?? null,
    total_units:     input.total_units ?? null,
    available_units: input.available_units ?? null,
    completion_date: input.completion_date ?? null,
    status:          input.status,
  }

  // Only admins may toggle is_master_template (also enforced by RLS).
  if (isAdmin && typeof input.is_master_template === "boolean") {
    update.is_master_template = input.is_master_template
  }

  // is_public is creator-controlled (RLS already restricts to ownership)
  if (typeof input.is_public === "boolean") {
    update.is_public = input.is_public
  }

  if (input.google_place_id !== undefined) {
    update.google_place_id = input.google_place_id || null
  }

  // RLS: agents can only update non-template projects they own
  const { data, error } = await supabase
    .from("projects")
    .update(update)
    .eq("id", id)
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath("/projects")
  revalidatePath(`/projects/${id}`)
  return { success: true, data }
}

export async function deleteProject(id: string): Promise<ActionResult> {
  await requireAuth()
  const supabase = await createClient()

  const { error } = await supabase
    .from("projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)

  if (error) return { success: false, error: error.message }

  revalidatePath("/projects")
  return { success: true, data: undefined }
}
