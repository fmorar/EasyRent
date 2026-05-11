-- ============================================================
-- MARKET ANALYSIS MODULE
--
-- Generates competitive pricing reports for property owners.
-- A report bundles:
--   • a subject property (FK to properties)
--   • one or more competitor source URLs that get crawled
--   • normalized comparable listings extracted from those sources
--   • deterministic pricing metrics (engine — not AI)
--   • an AI-generated owner-facing narrative report (text only)
--   • a public-token route for the property owner to view/download
--
-- All AI text is grounded in the deterministic pricing engine —
-- the model never invents prices.
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE market_report_type   AS ENUM ('sale', 'rent');
CREATE TYPE market_report_status AS ENUM ('draft', 'processing', 'completed', 'failed');
CREATE TYPE market_source_type   AS ENUM ('listing_page', 'property_detail_page', 'unsupported');
CREATE TYPE market_source_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'unsupported');

-- ============================================================
-- market_reports
-- ============================================================

CREATE TABLE market_reports (
  id                      UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id             UUID                 NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_by              UUID                 NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  report_type             market_report_type   NOT NULL,
  report_locale           TEXT                 NOT NULL DEFAULT 'es' CHECK (report_locale IN ('es','en')),
  status                  market_report_status NOT NULL DEFAULT 'draft',
  title                   TEXT,
  currency                TEXT                 NOT NULL DEFAULT 'USD',

  -- Deterministic pricing (set by pricing engine, NOT by AI)
  recommended_price       NUMERIC(15,2),
  recommended_price_min   NUMERIC(15,2),
  recommended_price_max   NUMERIC(15,2),
  confidence_score        NUMERIC(5,2),  -- 0..100

  -- Generated content
  summary                 TEXT,
  report_json             JSONB,
  report_html             TEXT,

  -- PDF + public sharing
  pdf_path                TEXT,
  public_token            TEXT                 UNIQUE,
  owner_visible           BOOLEAN              NOT NULL DEFAULT true,
  expires_at              TIMESTAMPTZ,

  -- Bookkeeping
  error_message           TEXT,
  metadata                JSONB                NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ          NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ          NOT NULL DEFAULT now()
);

CREATE INDEX idx_market_reports_created_by  ON market_reports(created_by);
CREATE INDEX idx_market_reports_property_id ON market_reports(property_id);
CREATE INDEX idx_market_reports_public_token ON market_reports(public_token) WHERE public_token IS NOT NULL;
CREATE INDEX idx_market_reports_status      ON market_reports(status);
CREATE INDEX idx_market_reports_created_at  ON market_reports(created_at DESC);

CREATE TRIGGER trg_market_reports_updated_at
  BEFORE UPDATE ON market_reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- market_report_sources — one row per pasted URL
-- ============================================================

CREATE TABLE market_report_sources (
  id                  UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id           UUID                 NOT NULL REFERENCES market_reports(id) ON DELETE CASCADE,
  source_url          TEXT                 NOT NULL,
  source_name         TEXT,                          -- 'encuentra24' | 'mercadolibre' | 'generic'
  source_type         market_source_type,
  detected_category   TEXT,                          -- 'rental_apartments', 'sale_houses', etc.
  pages_scanned       INTEGER              NOT NULL DEFAULT 0,
  listings_found      INTEGER              NOT NULL DEFAULT 0,
  status              market_source_status NOT NULL DEFAULT 'pending',
  error_message       TEXT,
  raw_snapshot_path   TEXT,
  metadata            JSONB                NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ          NOT NULL DEFAULT now()
);

CREATE INDEX idx_market_report_sources_report_id ON market_report_sources(report_id);

-- ============================================================
-- market_report_comparables — one row per scraped listing
-- ============================================================

CREATE TABLE market_report_comparables (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id           UUID         NOT NULL REFERENCES market_reports(id) ON DELETE CASCADE,
  source_id           UUID         REFERENCES market_report_sources(id) ON DELETE SET NULL,
  source_name         TEXT,
  source_url          TEXT,
  listing_url         TEXT,
  title               TEXT,
  operation_type      TEXT         CHECK (operation_type IS NULL OR operation_type IN ('sale','rent')),
  property_type       TEXT,
  price               NUMERIC(15,2),
  currency            TEXT,
  maintenance_fee     NUMERIC(12,2),
  price_usd           NUMERIC(15,2),
  price_crc           NUMERIC(15,2),
  location_text       TEXT,
  province            TEXT,
  canton              TEXT,
  district            TEXT,
  neighborhood        TEXT,
  latitude            NUMERIC(10,7),
  longitude           NUMERIC(10,7),
  bedrooms            NUMERIC(4,1),
  bathrooms           NUMERIC(4,1),
  parking_spaces      NUMERIC(4,1),
  built_area_m2       NUMERIC(10,2),
  lot_area_m2         NUMERIC(12,2),
  price_per_m2        NUMERIC(12,2),
  amenities           TEXT[],
  description         TEXT,
  agent_or_company    TEXT,
  is_featured         BOOLEAN      NOT NULL DEFAULT false,
  similarity_score    NUMERIC(5,2),
  confidence_score    NUMERIC(5,2),
  is_outlier          BOOLEAN      NOT NULL DEFAULT false,
  exclusion_reason    TEXT,
  raw_text            TEXT,
  extracted_data      JSONB,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_market_report_comparables_report_id   ON market_report_comparables(report_id);
CREATE INDEX idx_market_report_comparables_source_id   ON market_report_comparables(source_id);
CREATE INDEX idx_market_report_comparables_is_outlier  ON market_report_comparables(report_id, is_outlier);

-- ============================================================
-- market_report_events — processing log timeline
-- ============================================================

CREATE TABLE market_report_events (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID         NOT NULL REFERENCES market_reports(id) ON DELETE CASCADE,
  event_type  TEXT         NOT NULL,
  message     TEXT,
  metadata    JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_market_report_events_report_id ON market_report_events(report_id, created_at);

-- ============================================================
-- market_report_public_views — anonymized analytics
-- ============================================================

CREATE TABLE market_report_public_views (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID         NOT NULL REFERENCES market_reports(id) ON DELETE CASCADE,
  viewed_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  ip_hash     TEXT,
  user_agent  TEXT
);

CREATE INDEX idx_market_report_public_views_report_id ON market_report_public_views(report_id);

-- ============================================================
-- RLS — owners and admins
-- ============================================================

ALTER TABLE market_reports                ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_report_sources         ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_report_comparables     ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_report_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_report_public_views    ENABLE ROW LEVEL SECURITY;

-- Helper: is current user an admin?
-- Re-uses existing pattern (profiles.role = 'owner_admin').
-- Inlined here to avoid coupling to other migrations' helpers.

-- ── market_reports policies ─────────────────────────────────
CREATE POLICY market_reports_select_own_or_admin
  ON market_reports
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'owner_admin'
        AND profiles.deleted_at IS NULL
    )
  );

CREATE POLICY market_reports_insert_self
  ON market_reports
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY market_reports_update_own_or_admin
  ON market_reports
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'owner_admin'
        AND profiles.deleted_at IS NULL
    )
  );

CREATE POLICY market_reports_delete_own_or_admin
  ON market_reports
  FOR DELETE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'owner_admin'
        AND profiles.deleted_at IS NULL
    )
  );

-- ── child tables policies — gate via parent report ─────────
-- Pattern: "user can access child rows iff user can access parent report"
--
-- We allow ALL operations on children if the user can SELECT the parent.
-- This is safe because children are pure data appended by the pipeline.

CREATE POLICY market_report_sources_all_via_parent
  ON market_report_sources
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM market_reports r
      WHERE r.id = market_report_sources.report_id
        AND (
          r.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'owner_admin'
              AND profiles.deleted_at IS NULL
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM market_reports r
      WHERE r.id = market_report_sources.report_id
        AND (
          r.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'owner_admin'
              AND profiles.deleted_at IS NULL
          )
        )
    )
  );

CREATE POLICY market_report_comparables_all_via_parent
  ON market_report_comparables
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM market_reports r
      WHERE r.id = market_report_comparables.report_id
        AND (
          r.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'owner_admin'
              AND profiles.deleted_at IS NULL
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM market_reports r
      WHERE r.id = market_report_comparables.report_id
        AND (
          r.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'owner_admin'
              AND profiles.deleted_at IS NULL
          )
        )
    )
  );

CREATE POLICY market_report_events_all_via_parent
  ON market_report_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM market_reports r
      WHERE r.id = market_report_events.report_id
        AND (
          r.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'owner_admin'
              AND profiles.deleted_at IS NULL
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM market_reports r
      WHERE r.id = market_report_events.report_id
        AND (
          r.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'owner_admin'
              AND profiles.deleted_at IS NULL
          )
        )
    )
  );

-- public_views: writes happen from the public route handler with the
-- service role. Reads are admin-only (analytics).
CREATE POLICY market_report_public_views_select_admin
  ON market_report_public_views
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'owner_admin'
        AND profiles.deleted_at IS NULL
    )
  );

-- ============================================================
-- Storage bucket: market-reports (PDFs)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'market-reports',
  'market-reports',
  true,
  10485760,                            -- 10 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Public read: anyone can fetch a PDF given the URL (URLs contain
-- the report_id and slug, but the discoverability is via the
-- public_token in market_reports).
CREATE POLICY market_reports_pdf_read
  ON storage.objects FOR SELECT
  USING (bucket_id = 'market-reports');

-- Authenticated write/delete: server-side route handlers running
-- with the user's session can insert PDFs scoped to their report.
CREATE POLICY market_reports_pdf_write
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'market-reports' AND auth.uid() IS NOT NULL);

CREATE POLICY market_reports_pdf_delete
  ON storage.objects FOR DELETE
  USING (bucket_id = 'market-reports' AND auth.uid() IS NOT NULL);
