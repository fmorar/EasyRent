"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { slugify } from "@/lib/utils"
import type { ActionResult, BlogPost, BlogPostStatus } from "@/types"

export interface BlogPostFormInput {
  /** Optional — when omitted on create, we derive from title. */
  slug?:            string
  locale:           "es" | "en"
  title:            string
  excerpt?:         string
  body_html?:       string
  cover_url?:       string | null
  cover_alt?:       string | null
  category?:        string | null
  reading_minutes?: number | null
  seo_title?:       string | null
  seo_description?: string | null
  og_image_url?:    string | null
  /** Status to land on. The action handles the published_at side-effects. */
  status:           BlogPostStatus
}

/**
 * Create a blog post. Author = current user. If `slug` is omitted we
 * derive one from the title; we collision-check (slug, locale) and
 * append `-2`, `-3`, … until unique.
 */
export async function createBlogPost(
  input: BlogPostFormInput,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const { userId } = await requireAuth()
  const supabase = await createClient()

  const finalSlug = await ensureUniqueSlug(
    supabase, input.locale, input.slug?.trim() || slugify(input.title),
  )

  const nowIso = new Date().toISOString()
  const publishedAt = input.status === "published" ? nowIso : null

  const { data, error } = await supabase
    .from("blog_posts")
    .insert({
      slug:            finalSlug,
      locale:          input.locale,
      title:           input.title.trim(),
      excerpt:         input.excerpt?.trim()    || null,
      body_html:       input.body_html          || null,
      cover_url:       input.cover_url          || null,
      cover_alt:       input.cover_alt?.trim()  || null,
      category:        input.category?.trim()   || null,
      reading_minutes: input.reading_minutes    ?? null,
      seo_title:       input.seo_title?.trim()        || null,
      seo_description: input.seo_description?.trim()  || null,
      og_image_url:    input.og_image_url             || null,
      author_id:       userId,
      status:          input.status,
      published_at:    publishedAt,
    })
    .select("id, slug")
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath("/blog")
  revalidatePath(`/blog/${data.slug}`)
  revalidatePath("/dashboard/blog")
  return { success: true, data }
}

/**
 * Update an existing post. We preserve `published_at` across status
 * flips (so a post that briefly went back to draft keeps its original
 * publish date when re-published). Slug changes are allowed but
 * collision-checked.
 */
export async function updateBlogPost(
  id: string,
  input: BlogPostFormInput,
): Promise<ActionResult<{ id: string; slug: string }>> {
  await requireAuth()
  const supabase = await createClient()

  // Read current row to know the previous slug + published_at so we
  // can carry it forward on republish and revalidate the right path.
  const { data: current, error: readErr } = await supabase
    .from("blog_posts")
    .select("slug, locale, status, published_at")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (readErr || !current) {
    return { success: false, error: "No pudimos cargar el post." }
  }

  const desiredSlug = input.slug?.trim() || slugify(input.title)
  const finalSlug =
    desiredSlug === current.slug
      ? current.slug
      : await ensureUniqueSlug(supabase, input.locale, desiredSlug, id)

  const nowIso = new Date().toISOString()
  const publishedAt =
    input.status === "published"
      ? (current.published_at ?? nowIso)
      : current.published_at

  const { data, error } = await supabase
    .from("blog_posts")
    .update({
      slug:            finalSlug,
      locale:          input.locale,
      title:           input.title.trim(),
      excerpt:         input.excerpt?.trim()    || null,
      body_html:       input.body_html          || null,
      cover_url:       input.cover_url          || null,
      cover_alt:       input.cover_alt?.trim()  || null,
      category:        input.category?.trim()   || null,
      reading_minutes: input.reading_minutes    ?? null,
      seo_title:       input.seo_title?.trim()        || null,
      seo_description: input.seo_description?.trim()  || null,
      og_image_url:    input.og_image_url             || null,
      status:          input.status,
      published_at:    publishedAt,
    })
    .eq("id", id)
    .select("id, slug")
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath("/blog")
  revalidatePath(`/blog/${current.slug}`)
  if (current.slug !== data.slug) revalidatePath(`/blog/${data.slug}`)
  revalidatePath("/dashboard/blog")
  revalidatePath(`/dashboard/blog/${id}`)
  return { success: true, data }
}

/** Soft-delete a post — removes it from public listings + revalidates. */
export async function deleteBlogPost(id: string): Promise<ActionResult> {
  await requireAuth()
  const supabase = await createClient()

  const { data: row } = await supabase
    .from("blog_posts")
    .select("slug")
    .eq("id", id)
    .maybeSingle()

  const { error } = await supabase
    .from("blog_posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)

  if (error) return { success: false, error: error.message }

  revalidatePath("/blog")
  if (row?.slug) revalidatePath(`/blog/${row.slug}`)
  revalidatePath("/dashboard/blog")
  return { success: true, data: undefined }
}

// ── Read helpers (server components import these directly) ──────────

/**
 * Public listing — only published, non-deleted posts. Used by the
 * `/blog` index and the sitemap. Caller can scope by locale.
 */
export async function listPublishedPosts(opts: {
  locale: "es" | "en"
  limit?: number
}): Promise<{
  posts: Array<Pick<
    BlogPost,
    "id" | "slug" | "title" | "excerpt" | "cover_url" | "cover_alt" |
    "category" | "reading_minutes" | "published_at" | "author_id"
  >>
}> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("blog_posts")
    .select("id, slug, title, excerpt, cover_url, cover_alt, category, reading_minutes, published_at, author_id")
    .eq("locale", opts.locale)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("published_at", { ascending: false })
    .limit(opts.limit ?? 24)
  return { posts: data ?? [] }
}

/**
 * Public detail — published, non-deleted, matched by (locale, slug).
 * Returns null on miss so the page can call `notFound()`.
 */
export async function getPublishedPostBySlug(
  slug: string, locale: "es" | "en",
): Promise<BlogPost | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("locale", locale)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle()
  return (data as BlogPost | null) ?? null
}

// ── Internals ──────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js"
async function ensureUniqueSlug(
  supabase: SupabaseClient,
  locale:   string,
  base:     string,
  excludeId?: string,
): Promise<string> {
  const root = slugify(base) || "post"
  let candidate = root
  let n = 2
  // Worst case 50 tries — way more than needed in practice.
  for (let i = 0; i < 50; i++) {
    const query = supabase
      .from("blog_posts")
      .select("id")
      .eq("slug",   candidate)
      .eq("locale", locale)
      .is("deleted_at", null)
      .limit(1)
    if (excludeId) query.neq("id", excludeId)
    const { data } = await query
    if (!data || data.length === 0) return candidate
    candidate = `${root}-${n++}`
  }
  // Extreme fallback — append a short random suffix.
  return `${root}-${Math.random().toString(36).slice(2, 6)}`
}
