-- ============================================================
-- PROPERTY PERFORMANCE REPORTS
--
-- Mirror of the market-analysis report architecture, but answering
-- a different question for the owner: "How is my property performing
-- after publication?" — views, leads, conversion, recommendations.
--
-- Privacy: the public report uses get_public_property_performance_report()
-- which strips PII (full name → first name + initial, no phone/email,
-- no agent notes). The aggregator + OpenAI service work over that
-- already-redacted shape.
-- ============================================================

CREATE TYPE perf_report_status AS ENUM ('draft', 'processing', 'active', 'archived', 'failed');
CREATE TYPE perf_health_status AS ENUM ('strong', 'healthy', 'needs_attention', 'low_activity');

CREATE TABLE property_performance_reports (
  id                      UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id             UUID                 NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_by              UUID                 NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status                  perf_report_status   NOT NULL DEFAULT 'draft',
  -- Reporting window (defaults to "since publication")
  report_period_start     TIMESTAMPTZ,
  report_period_end       TIMESTAMPTZ,
  -- Visibility settings — the agent toggles what the owner sees on the
  -- public link. The public RPC uses these to gate sections.
  visibility_settings     JSONB                NOT NULL DEFAULT '{
    "show_lead_list":     true,
    "show_traffic":       true,
    "show_timeline":      true,
    "show_recommendations": true,
    "lead_initials_only": true
  }'::jsonb,
  -- Engine output (deterministic — NOT AI)
  performance_score       NUMERIC(5,2),                  -- 0..100
  performance_status      perf_health_status,
  -- AI narrative + computed report payload
  summary                 TEXT,
  report_json             JSONB,
  pdf_path                TEXT,
  public_token            TEXT                 UNIQUE,
  owner_visible           BOOLEAN              NOT NULL DEFAULT true,
  expires_at              TIMESTAMPTZ,
  -- Bookkeeping
  last_generated_at       TIMESTAMPTZ,
  error_message           TEXT,
  metadata                JSONB                NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ          NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ          NOT NULL DEFAULT now()
);

CREATE INDEX idx_perf_reports_property      ON property_performance_reports(property_id);
CREATE INDEX idx_perf_reports_created_by    ON property_performance_reports(created_by);
CREATE INDEX idx_perf_reports_public_token  ON property_performance_reports(public_token) WHERE public_token IS NOT NULL;
CREATE INDEX idx_perf_reports_status        ON property_performance_reports(status);
CREATE INDEX idx_perf_reports_created_at    ON property_performance_reports(created_at DESC);

CREATE TRIGGER trg_perf_reports_updated_at
  BEFORE UPDATE ON property_performance_reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Pipeline log (for the processing tab)
-- ============================================================

CREATE TABLE property_performance_report_events (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID         NOT NULL REFERENCES property_performance_reports(id) ON DELETE CASCADE,
  event_type  TEXT         NOT NULL,
  message     TEXT,
  metadata    JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_perf_report_events ON property_performance_report_events(report_id, created_at);

-- ============================================================
-- Anonymous public-view analytics (mirrors owner_report_public_views)
-- ============================================================

CREATE TABLE owner_report_public_views (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID         NOT NULL REFERENCES property_performance_reports(id) ON DELETE CASCADE,
  viewed_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  ip_hash     TEXT,
  user_agent  TEXT
);

CREATE INDEX idx_owner_report_views ON owner_report_public_views(report_id);

-- ============================================================
-- RLS — same pattern as market_reports
-- ============================================================

ALTER TABLE property_performance_reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_performance_report_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_report_public_views           ENABLE ROW LEVEL SECURITY;

CREATE POLICY perf_reports_select_own_or_admin
  ON property_performance_reports FOR SELECT
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'owner_admin' AND profiles.deleted_at IS NULL)
  );

CREATE POLICY perf_reports_insert_self
  ON property_performance_reports FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY perf_reports_update_own_or_admin
  ON property_performance_reports FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'owner_admin' AND profiles.deleted_at IS NULL)
  );

CREATE POLICY perf_reports_delete_own_or_admin
  ON property_performance_reports FOR DELETE
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'owner_admin' AND profiles.deleted_at IS NULL)
  );

CREATE POLICY perf_report_events_via_parent
  ON property_performance_report_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM property_performance_reports r
      WHERE r.id = property_performance_report_events.report_id
        AND (r.created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'owner_admin' AND profiles.deleted_at IS NULL))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM property_performance_reports r
      WHERE r.id = property_performance_report_events.report_id
        AND (r.created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'owner_admin' AND profiles.deleted_at IS NULL))
    )
  );

CREATE POLICY owner_report_views_select_admin
  ON owner_report_public_views FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'owner_admin' AND profiles.deleted_at IS NULL)
  );

-- ============================================================
-- Storage bucket: performance-reports (PDFs)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('performance-reports', 'performance-reports', true, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY perf_reports_pdf_read
  ON storage.objects FOR SELECT
  USING (bucket_id = 'performance-reports');

CREATE POLICY perf_reports_pdf_write
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'performance-reports' AND auth.uid() IS NOT NULL);

CREATE POLICY perf_reports_pdf_delete
  ON storage.objects FOR DELETE
  USING (bucket_id = 'performance-reports' AND auth.uid() IS NOT NULL);
