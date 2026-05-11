-- Newsletter subscribers — emails captured from the public footer
-- form. Kept separate from `leads` because subscribers are not part
-- of the sales pipeline (no stage, no agent assignment, no follow-up).
-- They just want to be kept informed.
--
-- Idempotent: subscribing the same email twice updates `subscribed_at`
-- and clears `unsubscribed_at` (re-opt-in). Email is stored lowercase
-- to defeat duplicates from case-only differences.

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email           citext      NOT NULL UNIQUE,
  -- Where the visitor signed up from (e.g. "Footer · /", "Footer · /agents/sofia").
  source_context  text,
  -- es / en — derived from the visitor's `NEXT_LOCALE` cookie at signup.
  locale          text        NOT NULL DEFAULT 'es',
  subscribed_at   timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz
);

-- citext is provided by the `citext` extension; enable it if it isn't
-- already (no-op when present).
CREATE EXTENSION IF NOT EXISTS citext;

-- Convert email to citext NOW that the extension is enabled — using a
-- separate ALTER so the table creation succeeds on first run.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'newsletter_subscribers'
      AND column_name = 'email'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE public.newsletter_subscribers
      ALTER COLUMN email TYPE citext USING email::citext;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS newsletter_subscribers_active_idx
  ON public.newsletter_subscribers (subscribed_at DESC)
  WHERE unsubscribed_at IS NULL;

-- ── RLS ────────────────────────────────────────────────────────
-- Public visitors can INSERT (sign up). Reading the subscriber list
-- is owner-admin-only — exposed via the dashboard, never via public
-- queries. The server action uses the admin client to bypass RLS for
-- inserts; the policy below is the belt-and-suspenders so a misuse
-- with the anon key still works for INSERT but not SELECT/UPDATE.

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "newsletter: public can subscribe"
  ON public.newsletter_subscribers;
CREATE POLICY "newsletter: public can subscribe"
  ON public.newsletter_subscribers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "newsletter: owner_admin reads"
  ON public.newsletter_subscribers;
CREATE POLICY "newsletter: owner_admin reads"
  ON public.newsletter_subscribers
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

COMMENT ON TABLE public.newsletter_subscribers IS
  'Emails captured by the footer newsletter form. Separate from `leads` (sales pipeline). Re-subscribing the same email reactivates a soft-unsubscribed row.';
