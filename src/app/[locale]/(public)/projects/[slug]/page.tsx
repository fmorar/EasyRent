import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import {
  MapPinIcon,
  HomeIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline"
import { PublicShareButton } from "@/components/sharing/public-share-button"
import { BedIcon, BathIcon, RulerIcon } from "@/lib/property-icons"
import { AmenitiesList } from "@/components/shared/amenities-list"
import { HtmlDescription } from "@/components/shared/html-description"
import { StatsStrip } from "@/components/shared/stats-strip"
import { LightboxProvider, LightboxTrigger } from "@/components/ui/lightbox"
import type { Metadata } from "next"
import type { Project, Property, Profile } from "@/types"
import { ProjectFaqSection } from "@/components/project/project-faq-section"
import { ProjectContactBand } from "@/components/project/project-contact-band"
import { GoogleReviewsEditorial } from "@/components/project/google-reviews-editorial"
import { PublicFooter } from "@/components/layout/public-footer"
import { fetchGoogleReviews } from "@/lib/google-places"
import { getLocale, getTranslations } from "next-intl/server"
import {
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildHreflangAlternates,
  buildProjectJsonLd,
  jsonLdScript,
} from "@/lib/seo/json-ld"

interface Props {
  params: Promise<{ slug: string }>
}

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  ?? "https://www.easyrent.house"
)

// ── Metadata ──────────────────────────────────────────────────────
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const locale   = await getLocale()
  const supabase = await createClient()

  const { data } = await supabase
    .from("projects")
    .select("title, description, is_public")
    .eq("slug", slug)
    .eq("is_master_template", true)
    .eq("is_public", true)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle()

  if (!data) return {}

  const stripHtml = (s: string) =>
    s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
  const description = data.description
    ? stripHtml(data.description).slice(0, 160)
    : (locale === "en"
        ? `Browse the residential project ${data.title}. View units, amenities, and request a private viewing.`
        : `Explorá el proyecto residencial ${data.title}. Conocé unidades disponibles, amenidades y agendá una visita.`)

  return {
    title:       data.title,
    description,
    alternates:  buildHreflangAlternates({
      path:    `/projects/${slug}`,
      locale,
      baseUrl: SITE_URL,
    }),
    openGraph: {
      type:        "website",
      title:       data.title,
      description,
      url:         `${SITE_URL}/${locale}/projects/${slug}`,
      siteName:    "easyrent",
      locale:      locale === "en" ? "en_US" : "es_CR",
    },
    twitter: {
      card:        "summary_large_image",
      title:       data.title,
      description,
    },
  }
}

const STATUS_LABELS: Record<string, string> = {
  pre_launch:         "Pre-lanzamiento",
  under_construction: "En construcción",
  completed:          "Completado",
  on_hold:            "En pausa",
}

// ── Page ──────────────────────────────────────────────────────────
export default async function ProjectPublicPage({ params }: Props) {
  const { slug } = await params
  const supabase  = await createClient()

  // Public project pages are reserved for master templates only.
  // An agent's own non-template project lives on their dashboard
  // but doesn't get a public URL — that path 404s by design.
  const { data: project } = await supabase
    .from("projects")
    .select(`
      *,
      project_photos(url, type, is_cover, order_index, caption),
      project_amenities(name, icon, sort_order)
    `)
    .eq("slug", slug)
    .eq("is_master_template", true)
    .eq("is_public", true)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle() as { data: Project & {
      project_photos: { url: string; type: string; is_cover: boolean; order_index: number; caption: string | null }[]
      project_amenities: { name: string; icon: string | null; sort_order: number }[]
    } | null }

  if (!project) notFound()

  const { data: properties } = await supabase
    .from("properties")
    .select(`
      id, slug, title, description, price, currency, property_type, status,
      bedrooms, bathrooms, area_sqm, display_address,
      property_photos(url, is_cover, order_index)
    `)
    .eq("project_id", project.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(6) as { data: (Property & {
      property_photos: { url: string; is_cover: boolean; order_index: number }[]
    })[] | null }

  const [{ data: faqs }, { data: agent }, googleData] = await Promise.all([
    supabase
      .from("project_faqs")
      .select("id, question, answer, sort_order")
      .eq("project_id", project.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, phone, email")
      .eq("id", project.created_by)
      .is("deleted_at", null)
      .maybeSingle() as unknown as Promise<{ data: Pick<Profile, "id" | "full_name" | "avatar_url" | "phone" | "email"> | null }>,
    project.google_place_id
      ? fetchGoogleReviews(project.google_place_id)
      : Promise.resolve(null),
  ])

  const photos     = [...(project.project_photos ?? [])].sort((a, b) => a.order_index - b.order_index)
  const heroPhoto  = photos.find((p) => p.is_cover) ?? photos[0]
  const galleryPhotos = photos.filter((p) => p !== heroPhoto).slice(0, 4)
  const totalPhotos   = photos.length

  const amenities = [...(project.project_amenities ?? [])].sort((a, b) => a.sort_order - b.sort_order)

  const totalUnits     = project.total_units ?? 0
  const availableUnits = project.available_units ?? 0
  const propsCount     = properties?.length ?? 0
  const completionTxt  = project.completion_date
    ? new Date(project.completion_date).toLocaleDateString("es-CR", { year: "numeric", month: "short" })
    : null

  // Editorial stats strip — only include the cells we have real data
  // for. Empty stats would dilute the band; better to render 3 strong
  // pairs than 4 with placeholder zeroes.
  const projectStats: Array<{ number: string; label: string }> = []
  if (project.total_units != null) {
    projectStats.push({
      number: project.total_units.toLocaleString("es-CR"),
      label:  "UNIDADES\nTOTALES",
    })
  }
  if (project.available_units != null && project.total_units != null && project.total_units > 0) {
    projectStats.push({
      number: project.available_units.toLocaleString("es-CR"),
      label:  "DISPONIBLES\nPARA RESERVA",
    })
  }
  if (amenities.length > 0) {
    projectStats.push({
      number: amenities.length.toLocaleString("es-CR"),
      label:  "AMENIDADES\nINCLUIDAS",
    })
  }
  if (project.completion_date) {
    projectStats.push({
      number: new Date(project.completion_date).getFullYear().toString(),
      label:  "AÑO\nDE ENTREGA",
    })
  }

  // ── SEO: BreadcrumbList + ApartmentComplex + FAQPage ────────────
  // Three structured-data payloads:
  //   - Breadcrumb gives Google the SERP-card breadcrumb trail
  //   - ApartmentComplex turns the project into a structured entity
  //     in the knowledge graph (carries address, amenities, total
  //     units, year built)
  //   - FAQPage (when present) unlocks the SERP accordion of Q&As
  const locale         = await getLocale()
  const tListings      = await getTranslations("publicProject")
  const tListingTypes  = await getTranslations("properties.listingTypes")
  const tPublicStatus  = await getTranslations("properties.publicStatuses")
  const projectUrl     = `${SITE_URL}/${locale}/projects/${project.slug ?? slug}`
  const breadcrumbs = buildBreadcrumbJsonLd([
    { name: locale === "en" ? "Home"     : "Inicio",     url: `${SITE_URL}/${locale}` },
    { name: locale === "en" ? "Projects" : "Proyectos",  url: `${SITE_URL}/${locale}` },
    { name: project.title, url: projectUrl },
  ])
  const projectImages = photos.map((p) => p.url)
  const projectSchema = buildProjectJsonLd({
    name:           project.title,
    url:            projectUrl,
    description:    project.description,
    imageUrls:      projectImages,
    displayAddress: project.location_label,
    totalUnits:     project.total_units,
    completionDate: project.completion_date,
    amenities:      amenities.map((a) => a.name),
  })
  const faqSchema = buildFaqJsonLd(
    (faqs ?? []).map((f) => ({ question: f.question, answer: f.answer })),
  )

  return (
    <div className="bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbs) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(projectSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(faqSchema) }}
        />
      )}

      {/* ─── HERO ────────────────────────────────────────────── */}
      <section className="relative h-[80vh] min-h-[480px] sm:min-h-[560px] lg:min-h-[620px] lg:h-[88vh] w-full overflow-hidden">
        {heroPhoto ? (
          <Image
            src={heroPhoto.url}
            alt={project.title}
            fill
            preload
            fetchPriority="high"
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-hero-fallback" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/20" />

        <div className="relative z-10 h-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-(--spacing-section) sm:pb-(--spacing-major)">
          {/* Top eyebrow */}
          <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-6">
            <span className="h-px w-8 sm:w-10 bg-white/40" />
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-white/80">
              {STATUS_LABELS[project.status] ?? project.status}
            </span>
            {project.developer_name && (
              <>
                <span className="text-white/40 hidden sm:inline">·</span>
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-white/80 truncate max-w-full">
                  {project.developer_name}
                </span>
              </>
            )}
          </div>

          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl sm:text-5xl lg:text-7xl font-heading font-bold text-white leading-[1.05] tracking-tight max-w-4xl">
              {project.title}
            </h1>
            <PublicShareButton
              path={`/projects/${project.slug}`}
              title={project.title}
              className="border-white/30 bg-white/10 hover:bg-white/20 backdrop-blur text-white shrink-0"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-white/80 text-sm">
            {project.location_label && (
              <span className="flex items-center gap-2">
                <MapPinIcon className="h-4 w-4" />
                {project.location_label}
              </span>
            )}
            {completionTxt && (
              <span>Entrega · <span className="font-numeric">{completionTxt}</span></span>
            )}
            {totalUnits > 0 && (
              <span><span className="font-numeric">{totalUnits}</span> unidades</span>
            )}
          </div>

          {/* Hero CTA — hidden on mobile (sticky bottom bar covers contact) */}
          <div className="mt-6 sm:mt-10 hidden sm:flex flex-wrap gap-2 sm:gap-3">
            {properties && properties.length > 0 && (
              <a
                href="#listings"
                className="inline-flex items-center gap-2 rounded-full bg-background text-foreground px-5 sm:px-6 h-11 text-sm font-medium hover:bg-background/90 transition-colors"
              >
                Ver listings
                <ArrowRightIcon className="h-4 w-4" />
              </a>
            )}
            <a
              href="#contact"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur border border-white/30 text-white px-5 sm:px-6 h-11 text-sm font-medium hover:bg-white/20 transition-colors"
            >
              Solicitar información
            </a>
          </div>
        </div>
      </section>

      {/* ─── STATS — same component the landing's TrustSignals uses,
              fed with project-specific numbers (units, amenities,
              year of delivery). Cells render only when we have real
              data so empty zeroes don't dilute the band. */}
      {projectStats.length > 0 && (
        <section className="border-b">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-(--spacing-section) md:py-(--spacing-major)">
            <StatsStrip stats={projectStats} />
          </div>
        </section>
      )}

      {/* ─── GALLERY ────────────────────────────────────────── */}
      {galleryPhotos.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-(--spacing-section) md:py-(--spacing-major)">
          <SectionHeader
            eyebrow="Galería"
            heading={<>Conocé <span className="text-foreground/40">el proyecto</span></>}
          />
          <LightboxProvider
            photos={photos.map((p) => ({ url: p.url, caption: p.caption }))}
          >
            <div className="mt-8 sm:mt-10 grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 h-[280px] sm:h-[360px] md:h-[480px]">
              {galleryPhotos[0] && (
                <LightboxTrigger
                  index={photos.indexOf(galleryPhotos[0])}
                  className="col-span-2 md:col-span-2 md:row-span-2 bg-muted rounded-xl sm:rounded-2xl overflow-hidden relative group cursor-zoom-in"
                >
                  <Image
                    src={galleryPhotos[0].url}
                    alt={galleryPhotos[0].caption ?? project.title}
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
                  />
                </LightboxTrigger>
              )}
              {galleryPhotos.slice(1, 4).map((p, i) => (
                <LightboxTrigger
                  key={i}
                  index={photos.indexOf(p)}
                  className={`bg-muted rounded-xl sm:rounded-2xl overflow-hidden relative group cursor-zoom-in ${
                    i === 0 ? "md:col-span-2" : ""
                  }`}
                >
                  <Image
                    src={p.url}
                    alt={p.caption ?? project.title}
                    fill
                    sizes="(min-width: 768px) 25vw, 50vw"
                    className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
                  />
                  {/* "+N" overlay on the last visible thumb if there are more */}
                  {i === 2 && totalPhotos > 4 && (
                    <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                      <span className="text-white text-2xl font-heading font-semibold">+{totalPhotos - 4}</span>
                    </div>
                  )}
                </LightboxTrigger>
              ))}
            </div>
          </LightboxProvider>
        </section>
      )}

      {/* ─── ABOUT + AMENITIES ──────────────────────────────────
              Reuses the same shared components the property page
              uses, so the visual treatment of headings + amenities
              grid + prose is identical across both detail surfaces. */}
      {(project.description || amenities.length > 0) && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-(--spacing-section) md:py-(--spacing-major) space-y-(--spacing-section)">
          <HtmlDescription
            html={project.description}
            heading="Sobre el proyecto"
            width="full"
            size="base"
          />
          <AmenitiesList
            amenities={amenities}
            heading="Amenidades"
          />
        </section>
      )}

      {/* ─── PROPERTIES ─────────────────────────────────────── */}
      {properties && properties.length > 0 && (
        <section id="listings" className="bg-muted/40 border-y py-(--spacing-section) md:py-(--spacing-major)">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Left-aligned editorial header instead of centered — breaks the
                centered-stack default and gives the band asymmetry. */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-(--spacing-block) lg:gap-(--spacing-section) mb-(--spacing-section)">
              <div className="lg:col-span-7">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-(--spacing-cluster)">
                  {tListings("listingsEyebrow")}
                </p>
                <h2 className="text-3xl sm:text-4xl font-heading font-bold tracking-tight leading-[1.05]">
                  {tListings("listingsHeadlinePrefix")}{" "}
                  <span className="text-foreground/40">{tListings("listingsHeadlineEmphasis")}</span>
                </h2>
              </div>
              <p className="lg:col-span-5 lg:pt-(--spacing-block) text-sm text-muted-foreground leading-relaxed max-w-md lg:text-right lg:ml-auto">
                {tListings("listingsSubheadline")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-(--spacing-block) sm:gap-(--spacing-section)">
              {properties.map((p) => {
                const cover =
                  p.property_photos?.find((ph) => ph.is_cover)
                  ?? p.property_photos?.sort((a, b) => a.order_index - b.order_index)[0]
                return (
                  <Link
                    key={p.id}
                    href={`/p/${p.slug}`}
                    className="group rounded-2xl overflow-hidden bg-card border hover:border-foreground/20 hover:shadow-lg transition-all"
                  >
                    <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                      {cover ? (
                        <Image
                          src={cover.url}
                          alt={p.title}
                          fill
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <HomeIcon className="h-8 w-8" />
                        </div>
                      )}
                      <div className="absolute top-3 left-3">
                        <Badge variant="secondary" className="text-xs bg-white/95 backdrop-blur shadow-sm">
                          {/* Headline state combines listing_type +
                              status, mirroring <MarketplaceCard>. The
                              previous version showed "En venta" for
                              every available unit regardless of intent
                              — rentals included. Now: available + rent
                              → "En alquiler"; sold + rent → "Alquilado";
                              everything else → the public status label. */}
                          {p.status === "available"
                            ? tListingTypes(p.listing_type)
                            : p.status === "sold"
                              ? tPublicStatus(p.listing_type === "rent" ? "rented" : "sold")
                              : tPublicStatus(p.status)}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div>
                        <h3 className="font-heading font-semibold leading-tight truncate">{p.title}</h3>
                        {p.display_address && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate mt-1">
                            <MapPinIcon className="h-3 w-3 shrink-0" />
                            {p.display_address}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t">
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          {p.bedrooms != null && (
                            <span className="inline-flex items-center gap-1">
                              <BedIcon className="h-3.5 w-3.5" />
                              <span className="font-numeric">{p.bedrooms}</span>
                            </span>
                          )}
                          {p.bathrooms != null && (
                            <span className="inline-flex items-center gap-1">
                              <BathIcon className="h-3.5 w-3.5" />
                              <span className="font-numeric">{p.bathrooms}</span>
                            </span>
                          )}
                          {p.area_sqm != null && (
                            <span className="inline-flex items-center gap-1">
                              <RulerIcon className="h-3.5 w-3.5" />
                              <span className="font-numeric">{p.area_sqm} m²</span>
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-numeric font-bold">
                          {p.currency} {p.price?.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─── GOOGLE REVIEWS · editorial showcase ────────────── */}
      {googleData && googleData.reviews.length > 0 && (
        <GoogleReviewsEditorial
          reviews={googleData.reviews}
          rating={googleData.rating}
          totalCount={googleData.user_ratings_total}
        />
      )}

      {/* ─── FAQ ────────────────────────────────────────────── */}
      {faqs && faqs.length > 0 && (
        <section className="bg-muted/40 border-y py-(--spacing-section) md:py-(--spacing-major)">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Left-aligned editorial header — varies from the centered
                stack used elsewhere on the page. */}
            <div className="max-w-2xl mb-(--spacing-section)">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-(--spacing-cluster)">
                FAQ
              </p>
              <h2 className="text-3xl sm:text-4xl font-heading font-bold tracking-tight leading-[1.05]">
                Preguntas{" "}
                <span className="text-foreground/40">frecuentes</span>
              </h2>
              <p className="mt-(--spacing-block) text-sm text-muted-foreground leading-relaxed max-w-xl">
                Resolvemos las dudas más comunes sobre este proyecto.
              </p>
            </div>
            <ProjectFaqSection
              faqs={faqs.map((f) => ({
                id:       f.id as string,
                question: f.question as string,
                answer:   f.answer as string,
              }))}
            />
          </div>
        </section>
      )}

      {/* ─── CONTACT BAND · dark editorial ──────────────────── */}
      {agent && (
        <ProjectContactBand
          projectId={project.id}
          projectTitle={project.title}
          locationLabel={project.location_label}
          agent={{
            id:         agent.id,
            full_name:  agent.full_name,
            avatar_url: agent.avatar_url,
            phone:      agent.phone,
            email:      agent.email,
          }}
        />
      )}

      {/* Public footer — unified bottom across landing + project pages.
              Reuses the project's hero photo as the wordmark backdrop
              so each project gets a brand-consistent close-out. */}
      <PublicFooter wordmarkPhotoUrl={heroPhoto?.url ?? null} />
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────
// Centering: only the inner text gets a max-width so it stays readable.
// The wrapper just sets text-align — the parent already controls block
// centering via its own max-w-* + mx-auto, so we don't double-center.
function SectionHeader({
  eyebrow,
  heading,
  subtitle,
  centered,
  small,
}: {
  eyebrow:    string
  /** Accepts a string or JSX so callers can split the headline into
   *  a solid + faded fragment (the two-tone editorial pattern used
   *  on the landing). */
  heading:    React.ReactNode
  subtitle?:  string
  centered?:  boolean
  small?:     boolean
}) {
  return (
    <div className={centered ? "text-center" : ""}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-4">
        {eyebrow}
      </p>
      <h2
        className={
          small
            ? "text-2xl font-heading font-bold tracking-tight"
            : "text-3xl sm:text-4xl font-heading font-bold tracking-tight"
        }
      >
        {heading}
      </h2>
      {subtitle && (
        <p className={
          centered
            ? "mt-4 text-sm text-muted-foreground max-w-xl mx-auto"
            : "mt-4 text-sm text-muted-foreground max-w-xl"
        }>
          {subtitle}
        </p>
      )}
    </div>
  )
}

