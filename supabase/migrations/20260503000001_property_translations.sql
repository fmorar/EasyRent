-- ============================================================
-- property_translations
-- Stores AI-generated + human-reviewed translations per locale.
-- ============================================================

CREATE TABLE IF NOT EXISTS property_translations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     uuid        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  locale          text        NOT NULL,
  title           text,
  description     text,
  public_address  text,
  seo_title       text,
  seo_description text,
  highlights      jsonb,
  translated_by   text        NOT NULL DEFAULT 'ai',
  status          text        NOT NULL DEFAULT 'auto_translated',
  source_hash     text,
  reviewed_at     timestamptz,
  reviewed_by     uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (property_id, locale),
  CHECK (locale       IN ('es', 'en')),
  CHECK (translated_by IN ('ai', 'human')),
  CHECK (status        IN ('pending', 'auto_translated', 'needs_review', 'reviewed'))
);

-- Index for fast lookup by property
CREATE INDEX IF NOT EXISTS idx_property_translations_property_id
  ON property_translations (property_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_property_translations_updated_at
  BEFORE UPDATE ON property_translations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE property_translations ENABLE ROW LEVEL SECURITY;

-- Public can read translations for marketplace-visible properties
CREATE POLICY "public read translations for public properties"
  ON property_translations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_translations.property_id
        AND p.status IN ('available', 'reserved')
        AND p.visibility = 'public'
    )
  );

-- Authenticated users (owner_admin) can do everything
CREATE POLICY "admin full access on translations"
  ON property_translations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = 'owner_admin'
        AND pr.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = 'owner_admin'
        AND pr.deleted_at IS NULL
    )
  );
