// Blog post detail — editorial single-article layout.
//
// Visual reference (per the project brief):
//   FASHION  ← category eyebrow
//   Minimal Style, Maximum Impact.     ← giant headline
//                                       ← intro paragraph (top-right rail)
//   [author avatar] Name · date · 6 min
//   [full-bleed hero photo]
//   Body article (heading + prose, image breaks)
//
// SEO:
//   • generateMetadata picks seo_title / seo_description (or falls
//     back to title / excerpt), and emits OpenGraph + Twitter cards
//     with `og:image = og_image_url || cover_url`.
//   • A `<script type="application/ld+json">` Article schema is
//     emitted inline so Google Search shows a rich result.
//   • A `<link rel="canonical">` is included via metadata.alternates.

import { getLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import { Link } from "@/i18n/navigation"
import { createClient } from "@/lib/supabase/server"
import { getPublishedPostBySlug } from "@/lib/actions/blog.actions"
import { PublicFooter } from "@/components/layout/public-footer"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ArrowLeftIcon } from "@heroicons/react/24/outline"
import type { Metadata } from "next"

interface Props {
  params: Promise<{ slug: string; locale: string }>
}

export const revalidate = 300

// ── Per-post metadata (title, description, OG, canonical) ─────────
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params
  const post = await getPublishedPostBySlug(slug, locale === "en" ? "en" : "es")
  if (!post) return { robots: { index: false, follow: false } }

  const title       = post.seo_title       ?? post.title
  const description = post.seo_description ?? post.excerpt ?? undefined
  const ogImage     = post.og_image_url    ?? post.cover_url ?? undefined
  const baseUrl     = process.env.NEXT_PUBLIC_SITE_URL ?? "https://easyrent.cr"
  const canonical   = `${baseUrl}/${locale}/blog/${post.slug}`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type:        "article",
      title,
      description,
      url:         canonical,
      siteName:    "easyrent",
      images:      ogImage ? [{ url: ogImage }] : undefined,
      locale:      locale === "en" ? "en_US" : "es_CR",
      publishedTime: post.published_at ?? undefined,
      modifiedTime:  post.updated_at,
    },
    twitter: {
      card:        "summary_large_image",
      title,
      description,
      images:      ogImage ? [ogImage] : undefined,
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const locale   = (await getLocale()) as "es" | "en"

  const post = await getPublishedPostBySlug(slug, locale)
  if (!post) notFound()

  const supabase = await createClient()
  // Author for the byline.
  const { data: author } = await supabase
    .from("profiles")
    .select("id, full_name, slug, avatar_url, bio")
    .eq("id", post.author_id)
    .maybeSingle()

  // Wordmark backdrop for the footer.
  const { data: cover } = await supabase
    .from("property_photos")
    .select("url")
    .eq("is_cover", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { url: string } | null }

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString(locale, {
        day: "numeric", month: "long", year: "numeric",
      })
    : null

  const initials = (author?.full_name ?? "?")
    .split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()

  // JSON-LD Article schema — emitted inline so Google can build a
  // rich result. Use absolute URLs everywhere.
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://easyrent.cr"
  const jsonLd  = {
    "@context":         "https://schema.org",
    "@type":            "Article",
    "headline":         post.title,
    "description":      post.seo_description ?? post.excerpt ?? undefined,
    "image":            post.og_image_url ?? post.cover_url ?? undefined,
    "datePublished":    post.published_at ?? undefined,
    "dateModified":     post.updated_at,
    "author":           author
      ? { "@type": "Person", "name": author.full_name, "url": `${baseUrl}/${locale}/agents/${author.slug}` }
      : undefined,
    "publisher": {
      "@type": "Organization",
      "name":  "easyrent",
      "url":   baseUrl,
    },
    "mainEntityOfPage": `${baseUrl}/${locale}/blog/${post.slug}`,
  }

  return (
    <div className="bg-background">
      {/* JSON-LD for Google's rich-result */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-(--spacing-major) pb-(--spacing-major)">
        {/* Back to index — small text link, doesn't compete with the headline. */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Volver al blog
        </Link>

        {/* ── Header — eyebrow + title spans 2/3, intro on right rail. */}
        <header className="mt-(--spacing-block) grid grid-cols-1 lg:grid-cols-12 gap-(--spacing-section) items-end">
          <div className="lg:col-span-8 space-y-(--spacing-cluster)">
            {post.category && (
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {post.category}
              </p>
            )}
            <h1
              className="font-heading font-bold tracking-tight leading-[1.02]"
              style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)" }}
            >
              {post.title}
            </h1>
          </div>
          {post.excerpt && (
            <p className="lg:col-span-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
              {post.excerpt}
            </p>
          )}
        </header>

        {/* ── Byline row ─────────────────────────────────────── */}
        <div className="mt-(--spacing-block) flex items-center gap-(--spacing-cluster) flex-wrap text-sm">
          {author && (
            <Link
              href={`/agents/${author.slug}`}
              className="inline-flex items-center gap-2 group"
            >
              <Avatar className="h-9 w-9">
                <AvatarImage src={author.avatar_url ?? undefined} alt={author.full_name} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="font-medium group-hover:underline underline-offset-4 decoration-foreground/30">
                {author.full_name}
              </span>
            </Link>
          )}
          {formattedDate && (
            <>
              <span className="text-muted-foreground">·</span>
              <time dateTime={post.published_at ?? undefined} className="text-muted-foreground font-numeric">
                {formattedDate}
              </time>
            </>
          )}
          {post.reading_minutes != null && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground font-numeric">
                {post.reading_minutes} min
              </span>
            </>
          )}
          {post.category && (
            <Badge variant="outline" className="ml-auto text-[10px]">{post.category}</Badge>
          )}
        </div>

        {/* ── Hero photo ─────────────────────────────────────── */}
        {post.cover_url && (
          <figure className="mt-(--spacing-section) rounded-2xl overflow-hidden bg-muted">
            <div className="relative aspect-[16/9] sm:aspect-[21/9]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.cover_url}
                alt={post.cover_alt ?? post.title}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          </figure>
        )}

        {/* ── Body ───────────────────────────────────────────── */}
        {post.body_html && (
          <div
            className="preview-prose mt-(--spacing-section) text-base text-foreground/90 leading-relaxed max-w-prose mx-auto"
            dangerouslySetInnerHTML={{ __html: post.body_html }}
          />
        )}

        {/* ── Author footer ─────────────────────────────────── */}
        {author && (
          <footer className="mt-(--spacing-section) border-t pt-(--spacing-block) max-w-prose mx-auto">
            <Link
              href={`/agents/${author.slug}`}
              className="flex items-center gap-(--spacing-cluster) group"
            >
              <Avatar className="h-12 w-12 shrink-0">
                <AvatarImage src={author.avatar_url ?? undefined} alt={author.full_name} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Escrito por</p>
                <p className="font-medium group-hover:underline underline-offset-4 decoration-foreground/30">
                  {author.full_name}
                </p>
                {author.bio && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{author.bio}</p>
                )}
              </div>
            </Link>
          </footer>
        )}
      </article>

      <PublicFooter wordmarkPhotoUrl={post.cover_url ?? cover?.url ?? null} />
    </div>
  )
}
