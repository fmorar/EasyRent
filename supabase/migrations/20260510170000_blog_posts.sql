-- Blog posts — long-form editorial content authored by the team
-- (admins/agents) and surfaced under /blog. Carries everything an
-- SEO-friendly article needs: slug, cover, excerpt, author, category,
-- canonical metadata, locale, and a publish lifecycle.
--
-- Storage: body is HTML (produced by the existing TipTap editor).
-- One row per locale; the same idea published in both ES and EN
-- lives as two separate rows linked only by slug coincidence.

CREATE TYPE blog_post_status AS ENUM ('draft', 'published', 'archived');

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT        NOT NULL,
  locale          TEXT        NOT NULL DEFAULT 'es' CHECK (locale IN ('es', 'en')),

  title           TEXT        NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  /** Short summary used on cards + as the default <meta description>. */
  excerpt         TEXT        CHECK (excerpt IS NULL OR char_length(excerpt) <= 320),
  /** Rendered article HTML — comes from the TipTap editor. */
  body_html       TEXT,
  cover_url       TEXT,
  cover_alt       TEXT        CHECK (cover_alt IS NULL OR char_length(cover_alt) <= 200),
  /** Editorial category surfaced in the eyebrow above the title. */
  category        TEXT        CHECK (category IS NULL OR char_length(category) <= 60),
  /** Author-provided reading time (in minutes). Optional; the UI also
   *  has a JS estimate as fallback. */
  reading_minutes INTEGER     CHECK (reading_minutes IS NULL OR (reading_minutes > 0 AND reading_minutes <= 120)),

  -- SEO overrides (fall back to title/excerpt when null)
  seo_title       TEXT        CHECK (seo_title IS NULL OR char_length(seo_title) <= 70),
  seo_description TEXT        CHECK (seo_description IS NULL OR char_length(seo_description) <= 200),
  og_image_url    TEXT,

  author_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,

  status          blog_post_status NOT NULL DEFAULT 'draft',
  /** Set when the post first transitions into 'published'. Null while
   *  draft / archived. The server action keeps it stable across
   *  unpublish/republish so URLs remain canonical. */
  published_at    TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,

  /** One slug per locale. Posts can share a slug across locales (es/en
   *  versions of the same article) but never within the same locale. */
  UNIQUE (slug, locale)
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_published
  ON public.blog_posts (locale, published_at DESC)
  WHERE deleted_at IS NULL AND status = 'published';

CREATE INDEX IF NOT EXISTS idx_blog_posts_author
  ON public.blog_posts (author_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_blog_posts_category
  ON public.blog_posts (category)
  WHERE deleted_at IS NULL AND status = 'published';

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_blog_posts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS blog_posts_set_updated_at ON public.blog_posts;
CREATE TRIGGER blog_posts_set_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_blog_posts_updated_at();

-- ── RLS ────────────────────────────────────────────────────────
-- Public surfaces (/blog, /blog/[slug]) need to read PUBLISHED posts
-- without auth. The dashboard (admin) needs full CRUD. Authors can
-- read+update their own drafts. Soft-deleted rows are invisible.

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Anon + authenticated: see published, non-deleted posts only.
DROP POLICY IF EXISTS "blog_posts: anyone reads published"
  ON public.blog_posts;
CREATE POLICY "blog_posts: anyone reads published"
  ON public.blog_posts
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'
    AND deleted_at IS NULL
  );

-- Authors read their own (draft / archived / whatever).
DROP POLICY IF EXISTS "blog_posts: author reads own"
  ON public.blog_posts;
CREATE POLICY "blog_posts: author reads own"
  ON public.blog_posts
  FOR SELECT
  TO authenticated
  USING (author_id = auth.uid() AND deleted_at IS NULL);

-- Admins see everything.
DROP POLICY IF EXISTS "blog_posts: admin reads all"
  ON public.blog_posts;
CREATE POLICY "blog_posts: admin reads all"
  ON public.blog_posts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'owner_admin'
        AND p.deleted_at IS NULL
    )
  );

-- Insert: any authenticated user with a profile (admins + agents).
-- The server action enforces author_id = auth.uid().
DROP POLICY IF EXISTS "blog_posts: authenticated inserts"
  ON public.blog_posts;
CREATE POLICY "blog_posts: authenticated inserts"
  ON public.blog_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Update: author OR admin.
DROP POLICY IF EXISTS "blog_posts: author or admin updates"
  ON public.blog_posts;
CREATE POLICY "blog_posts: author or admin updates"
  ON public.blog_posts
  FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'owner_admin'
        AND p.deleted_at IS NULL
    )
  );

COMMENT ON TABLE public.blog_posts IS
  'Editorial blog posts surfaced at /blog. One row per locale; body is HTML from the TipTap editor.';
