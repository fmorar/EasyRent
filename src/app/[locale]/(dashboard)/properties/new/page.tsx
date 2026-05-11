// ============================================================
// "New property" entry point
//
// Mirrors the edit experience: instead of a separate two-step form,
// we create a draft record server-side and redirect straight to
// `/properties/[id]`. From there the user gets the SAME UI the edit
// page has — form, photo uploader, EN translation tab, video manager,
// and the live preview, all on one screen.
//
// Drafts use `slug = draft-<nanoid>` and `is_marketplace_visible=false`
// so they aren't publicly discoverable. The user fills the fields and
// hits Save like any other edit.
// ============================================================

import { redirect } from "next/navigation"
import { getLocale } from "next-intl/server"
import { requireAuth } from "@/lib/auth"
import { createDraftProperty } from "@/lib/actions/property.actions"

export default async function NewPropertyPage() {
  await requireAuth()
  const locale = await getLocale()

  const result = await createDraftProperty()

  if (!result.success) {
    // Bounce back to the list with a query flag the list page could
    // surface as a toast — keeps this entry point side-effect free.
    redirect(`/${locale}/properties?draft_error=1`)
  }

  redirect(`/${locale}/properties/${result.data.id}`)
}
