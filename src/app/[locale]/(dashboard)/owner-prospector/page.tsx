// Admin-only "Owner prospector" — paste an encuentra24 (or similar)
// listing URL, the tool crawls it, classifies each result as
// "published by owner" vs "agency", and returns a ranked list of
// likely owner-published prospects for cold outreach.
//
// Why admin-only: the data we surface (raw text from third-party
// portals, contact-extraction hints) is sensitive territory. Only
// `owner_admin` profiles see this page.

import { redirect } from "next/navigation"
import { getLocale } from "next-intl/server"
import { requireAuth } from "@/lib/auth"
import { OwnerProspectorClient } from "@/components/owner-prospector/owner-prospector-client"

// The fetcher rate-limits at 1 req/sec/host, so a 300-listing scan
// with profile enrichment can take ~5 minutes (300 detail pages +
// ~30 profile pages). Max it out — Vercel Pro caps at 300s and Hobby
// at 60s; the action stops itself early on Hobby anyway.
export const maxDuration = 300

export default async function OwnerProspectorPage() {
  const { profile } = await requireAuth()
  if (profile.role !== "owner_admin") {
    const locale = await getLocale()
    redirect(`/${locale}/dashboard`)
  }
  return (
    // `w-full` + `max-w-5xl` keeps the entire tool at the same width
    // regardless of state. Without an explicit `w-full`, the wrapper
    // would shrink to its widest child when content is small — making
    // the form card look narrower in idle/empty states than when the
    // table is mounted.
    <div className="w-full max-w-5xl mx-auto space-y-(--spacing-section)">
      <header className="space-y-(--spacing-tight)">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
          Captación de dueños
        </h1>
        <p className="text-sm text-muted-foreground">
          Pegá un link de búsqueda de encuentra24, MercadoLibre u otro
          portal. Detectamos los listados que parecen publicados por dueño
          directo para que los contactes en frío antes que la competencia.
        </p>
      </header>
      <OwnerProspectorClient />
    </div>
  )
}
