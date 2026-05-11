// GET /api/contracts/:id/events — full audit timeline.

import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  await requireAuth()
  const { id }   = await params
  const supabase = await createClient()

  // The created_by FK on contract_events points to auth.users(id),
  // not profiles. We can't auto-join profiles via Supabase relation
  // syntax, so we fetch events first and hydrate authors with a
  // second query keyed by profile.id (== auth.uid()).
  const { data: events, error } = await supabase
    .from("contract_events")
    .select("id, event_type, message, metadata, created_at, created_by")
    .eq("contract_id", id)
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const authorIds = Array.from(
    new Set((events ?? []).map((e) => e.created_by).filter((v): v is string => !!v)),
  )
  const authorsById: Record<string, { id: string; full_name: string; avatar_url: string | null }> = {}
  if (authorIds.length > 0) {
    const { data: authors } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", authorIds)
    for (const a of authors ?? []) authorsById[a.id] = a
  }

  const hydrated = (events ?? []).map((e) => ({
    ...e,
    author: e.created_by ? authorsById[e.created_by] ?? null : null,
  }))
  return NextResponse.json({ events: hydrated })
}
