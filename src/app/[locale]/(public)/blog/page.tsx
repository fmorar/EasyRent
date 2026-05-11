// Public blog index — list of published posts. Editorial register:
// big headline at the top, then a grid of post cards with cover +
// category eyebrow + title + excerpt. Empty state when nothing is
// published yet.

import { getLocale, getTranslations } from "next-intl/server"
import { createClient } from "@/lib/supabase/server"
import { Link } from "@/i18n/navigation"
import { listPublishedPosts } from "@/lib/actions/blog.actions"
import { PublicFooter } from "@/components/layout/public-footer"
import { Badge } from "@/components/ui/badge"
import type { Metadata } from "next"

export const revalidate = 300  // ISR — refresh every 5 min

export async function generateMetadata(): Promise<Metadata> {
  return {
    title:       "Blog · análisis del mercado inmobiliario en Costa Rica",
    description:
      "Guías, mercado y consejos para quienes compran, alquilan o invierten en propiedades en Costa Rica.",
  }
}

export default async function BlogIndexPage() {
  const locale = await getLocale() as "es" | "en"
  const t      = await getTranslations("blog")

  const [{ posts }, supabase] = await Promise.all([
    listPublishedPosts({ locale, limit: 24 }),
    createClient(),
  ])

  // Pull the most recent property cover for the footer wordmark
  // backdrop (keeps the footer treatment consistent across pages).
  const { data: cover } = await supabase
    .from("property_photos")
    .select("url")
    .eq("is_cover", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { url: string } | null }

  // Author display names — one query for all authors in the page.
  const authorIds = Array.from(new Set(posts.map((p) => p.author_id)))
  const { data: authors } = authorIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, slug, avatar_url")
        .in("id", authorIds)
    : { data: [] }
  const authorById = new Map(
    (authors ?? []).map((a) => [a.id, a as { id: string; full_name: string; slug: string; avatar_url: string | null }]),
  )

  return (
    <div className="bg-background">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-(--spacing-major) pb-(--spacing-section)">
        <div className="max-w-3xl space-y-(--spacing-block)">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {t("eyebrow")}
          </p>
          <h1
            className="font-heading font-bold tracking-tight leading-[1.02] text-foreground"
            style={{ fontSize: "clamp(2.25rem, 5vw, 4rem)" }}
          >
            {t("indexTitle")}{" "}
            <span className="text-foreground/40">{t("indexTitleAccent")}</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
            {t("indexLead")}
          </p>
        </div>
      </section>

      {/* ── Grid / empty state ────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-(--spacing-major)">
        {posts.length === 0 ? (
          <div className="max-w-2xl mx-auto text-center py-16 sm:py-20 border rounded-2xl space-y-3">
            <p className="text-base font-heading font-semibold">{t("emptyHeadline")}</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {t("emptyBody")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-(--spacing-block) sm:gap-(--spacing-section)">
            {posts.map((p) => {
              const author = authorById.get(p.author_id)
              return (
                <article key={p.id} className="group space-y-(--spacing-cluster)">
                  <Link
                    href={`/blog/${p.slug}`}
                    className="block aspect-[16/10] overflow-hidden rounded-xl bg-muted"
                  >
                    {p.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.cover_url}
                        alt={p.cover_alt ?? p.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-(--duration-major) ease-(--ease-out-quart) group-hover:scale-[1.02]"
                      />
                    ) : null}
                  </Link>
                  <div className="space-y-(--spacing-tight)">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      {p.category && <Badge variant="outline" className="text-[10px]">{p.category}</Badge>}
                      {p.published_at && (
                        <time dateTime={p.published_at} className="font-numeric">
                          {new Date(p.published_at).toLocaleDateString(locale, {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </time>
                      )}
                      {p.reading_minutes != null && (
                        <span className="font-numeric">· {p.reading_minutes} {t("minRead")}</span>
                      )}
                    </div>
                    <h2 className="text-lg sm:text-xl font-heading font-bold tracking-tight leading-snug">
                      <Link href={`/blog/${p.slug}`} className="hover:underline decoration-foreground/30 underline-offset-4">
                        {p.title}
                      </Link>
                    </h2>
                    {p.excerpt && (
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                        {p.excerpt}
                      </p>
                    )}
                    {author && (
                      <p className="text-xs text-muted-foreground">
                        {t("by")} <span className="text-foreground font-medium">{author.full_name}</span>
                      </p>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <PublicFooter wordmarkPhotoUrl={cover?.url ?? null} />
    </div>
  )
}
