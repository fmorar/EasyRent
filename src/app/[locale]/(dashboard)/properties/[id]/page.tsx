import { requireAuth } from "@/lib/auth"
import { isAdminRole } from "@/lib/roles"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { ArrowLeftIcon } from "@heroicons/react/24/outline"
import { Badge } from "@/components/ui/badge"
import { SaveFormButton } from "@/components/property/save-form-button"
import { AutoSharePrompt } from "@/components/sharing/auto-share-prompt"
import { getPropertyTranslations } from "@/lib/actions/translation.actions"
import { PropertyEditClient } from "@/components/property/property-edit-client"
import type { Property, Owner } from "@/types"
import type { PhotoRow } from "@/components/property/photo-uploader"
import type { VideoRow } from "@/lib/actions/media.actions"

interface Props {
  params: Promise<{ id: string }>
}

export default async function PropertyEditPage({ params }: Props) {
  const { id }        = await params
  // requireAuth (not requireAdmin): agents need to edit the properties
  // they create. RLS on `properties` already scopes what they can read
  // — anything outside their scope errors and falls through to
  // notFound() below, which is the right UX.
  const { profile }   = await requireAuth()
  const supabase      = await createClient()
  const t             = await getTranslations("translations")
  const tEdit         = await getTranslations("propertyEdit")
  const tStatus       = await getTranslations("properties.publicStatuses")

  const { data: property, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single() as { data: Property | null; error: unknown }

  if (error || !property) notFound()

  // A viewer who reached this row via a property_shares record (not as
  // the original creator) should see the listing but not be able to
  // edit it — the property still belongs to the agent who uploaded it.
  // RLS already rejects writes from non-owners, so this is a UX gate
  // that prevents the agent from typing into fields that will 403 on
  // save.
  const canEdit = property.created_by === profile.id || isAdminRole(profile.role)

  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, slug, is_master_template, forked_from")
    .is("deleted_at", null)
    .order("title")

  const translations  = await getPropertyTranslations(id)
  const enTranslation = translations.find((tr) => tr.locale === "en") ?? null

  const { data: owner } = property.owner_id
    ? await supabase
        .from("owners")
        .select("*")
        .eq("id", property.owner_id)
        .single() as { data: Owner | null }
    : { data: null }

  const { data: photosRaw } = await supabase
    .from("property_photos")
    .select("id, url, storage_path, is_cover, order_index, caption")
    .eq("property_id", id)
    .order("order_index") as { data: PhotoRow[] | null }

  const photos: PhotoRow[] = photosRaw ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyClient = supabase as unknown as { from: (t: string) => any }
  const { data: videosRaw } = await anyClient
    .from("property_videos")
    .select("id, property_id, youtube_url, title, order_index, created_at")
    .eq("property_id", id)
    .order("order_index") as { data: VideoRow[] | null }

  const videos: VideoRow[] = videosRaw ?? []

  // Inheritance bundle: when the property has a project, the property
  // inherits the project's title/description/location, plus its amenities
  // and photos are merged into the property's view.
  let projectInheritance: import("@/lib/inheritance").ProjectInheritance | null = null
  if (property.project_id) {
    const [{ data: parentProject }, { data: parentAmenities }, { data: parentPhotos }] =
      await Promise.all([
        supabase
          .from("projects")
          .select("id, title, description, location_label")
          .eq("id", property.project_id)
          .is("deleted_at", null)
          .maybeSingle(),
        supabase
          .from("project_amenities")
          .select("name, sort_order")
          .eq("project_id", property.project_id)
          .order("sort_order", { ascending: true }),
        supabase
          .from("project_photos")
          .select("id, url, is_cover, order_index, caption")
          .eq("project_id", property.project_id)
          .order("order_index", { ascending: true }),
      ])

    if (parentProject) {
      projectInheritance = {
        id:             parentProject.id,
        title:          parentProject.title,
        description:    parentProject.description,
        location_label: parentProject.location_label,
        amenities:      (parentAmenities ?? []).map((a) => a.name),
        photos:         (parentPhotos ?? []) as import("@/lib/inheritance").ProjectInheritance["photos"],
      }
    }
  }

  return (
    // Bleed out of the dashboard's p-4 padding and fill viewport height minus header (64px)
    <div className="-mx-4 -mb-4 flex flex-col" style={{ height: "calc(100svh - 64px)" }}>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-3 border-b bg-background">
        <Link
          href="/properties"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{tEdit("backToProperties")}</span>
        </Link>
        <span className="text-muted-foreground/40 hidden sm:inline">/</span>
        <span className="text-sm font-medium truncate min-w-0">{property.title}</span>
        <Badge variant="secondary" className="text-xs hidden md:inline-flex shrink-0">
          {(() => {
            const key = property.status as Parameters<typeof tStatus>[0]
            try { return tStatus(key) } catch { return property.status }
          })()}
        </Badge>
        <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
          {property.slug && (
            <Link
              href={`/p/${property.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              {tEdit("viewPublicPage")}
            </Link>
          )}
          {canEdit ? (
            <SaveFormButton formId="property-details-form" />
          ) : (
            <Badge variant="outline" className="text-xs">{tEdit("readOnlyBadge")}</Badge>
          )}
        </div>
      </div>

      {/* Auto-open share dialog when arriving with ?share=1 (after-create flow) */}
      <AutoSharePrompt
        propertyId={property.id}
        propertyTitle={property.title}
        propertySlug={property.slug}
        isMarketplaceVisible={property.is_marketplace_visible}
        initialAnonymousSlug={property.anonymous_slug}
      />

      {/* ── Split layout (client — live preview) ───────────── */}
      <PropertyEditClient
        property={property}
        profile={profile}
        projects={projects ?? []}
        initialOwner={owner}
        photos={photos}
        videos={videos}
        enTranslation={enTranslation}
        projectInheritance={projectInheritance}
        canEdit={canEdit}
        tTabEn={t("tabEn")}
        tAiNote={t("aiNote")}
      />
    </div>
  )
}

