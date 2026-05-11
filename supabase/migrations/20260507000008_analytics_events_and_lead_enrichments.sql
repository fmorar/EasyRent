-- ============================================================
-- ANALYTICS + LEAD ENRICHMENTS
--
-- Two changes that together unlock the Owner Performance Report:
--
--   1. property_analytics_events: append-only event log of every
--      public-page interaction with a property. Source of truth
--      for views, clicks, conversion, traffic sources.
--
--   2. leads: enriched with structured fields the public form
--      now captures (move-in window, party size, budget, etc.)
--      AND fields the agent fills as the lead progresses
--      (appointment_at, lost_reason, last_contacted_at, …).
--
-- Privacy:
--   - analytics events store visitor_id (random nanoid in cookie),
--     never PII. Lead linkage is via UUID (anonymous to the event
--     consumer).
--   - Lead PII (name/email/phone) stays in `leads`; the public
--     RPC will project safe fields only when the report is rendered.
-- ============================================================

-- ============================================================
-- ENUMS for lead enrichments
-- ============================================================

CREATE TYPE lead_interest_level     AS ENUM ('low', 'medium', 'high');
CREATE TYPE lead_inquiry_type       AS ENUM ('availability', 'visit', 'info');
CREATE TYPE lead_move_in_window     AS ENUM (
  'immediate', 'one_month', 'one_to_three_months', 'three_to_six_months', 'browsing'
);
CREATE TYPE lead_pets_status        AS ENUM ('none', 'small_dog', 'large_dog', 'cat', 'multiple');
CREATE TYPE lead_budget_range       AS ENUM (
  'under_1000', 'between_1000_1500', 'between_1500_2000', 'between_2000_3000', 'above_3000'
);
CREATE TYPE lead_contact_channel    AS ENUM ('whatsapp', 'phone', 'email', 'in_person', 'other');
CREATE TYPE lead_appointment_status AS ENUM ('scheduled', 'completed', 'no_show', 'cancelled', 'pending');
CREATE TYPE lead_lost_reason        AS ENUM (
  'price_too_high',
  'location_not_fit',
  'pets_not_allowed',
  'insufficient_parking',
  'move_in_date_mismatch',
  'budget_too_low',
  'rented_or_bought_elsewhere',
  'unresponsive',
  'not_qualified',
  'other'
);

-- ============================================================
-- ALTER leads — capture-by-design fields
-- ============================================================

ALTER TABLE leads
  -- From the public lead form (captured automatically when the lead opts in)
  ADD COLUMN inquiry_type        lead_inquiry_type,
  ADD COLUMN move_in_window      lead_move_in_window,
  ADD COLUMN has_pets            lead_pets_status,
  ADD COLUMN party_size          INTEGER CHECK (party_size IS NULL OR party_size BETWEEN 1 AND 20),
  ADD COLUMN budget_range        lead_budget_range,
  ADD COLUMN how_did_you_find    TEXT,
  ADD COLUMN preferred_visit_at  TIMESTAMPTZ,
  -- Computed at lead creation from the answers above (see schemas.ts)
  ADD COLUMN interest_level      lead_interest_level NOT NULL DEFAULT 'medium',
  -- Agent-filled as the lead progresses through the kanban
  ADD COLUMN appointment_at      TIMESTAMPTZ,
  ADD COLUMN appointment_status  lead_appointment_status,
  ADD COLUMN appointment_notes   TEXT,
  ADD COLUMN contact_channel     lead_contact_channel,
  ADD COLUMN last_contacted_at   TIMESTAMPTZ,
  ADD COLUMN next_follow_up_at   TIMESTAMPTZ,
  ADD COLUMN lost_reason         lead_lost_reason,
  ADD COLUMN visit_feedback      TEXT,
  -- AI extraction output (questions + objections + sentiment)
  ADD COLUMN extracted_data      JSONB,
  -- Public-safe summary the owner report shows
  ADD COLUMN public_summary      TEXT;

-- Useful indexes for the report aggregations
CREATE INDEX idx_leads_property_created_at    ON leads(property_id, created_at DESC) WHERE deleted_at IS NULL AND is_archived = false;
CREATE INDEX idx_leads_appointment_at         ON leads(appointment_at) WHERE appointment_at IS NOT NULL;
CREATE INDEX idx_leads_interest_level         ON leads(property_id, interest_level) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_lost_reason            ON leads(property_id, lost_reason) WHERE lost_reason IS NOT NULL;

-- ============================================================
-- property_analytics_events
-- ============================================================

CREATE TYPE property_event_type AS ENUM (
  'property_viewed',
  'property_unique_viewed',
  'whatsapp_clicked',
  'call_clicked',
  'email_clicked',
  'contact_form_started',
  'contact_form_submitted',
  'favorite_added',
  'share_clicked',
  'gallery_opened',
  'map_opened',
  'video_tour_opened',
  'pdf_downloaded',
  'deep_engagement',
  'anonymous_link_viewed',
  'lead_created',
  'lead_contacted',
  'appointment_scheduled',
  'appointment_completed',
  'appointment_cancelled',
  'appointment_no_show',
  'offer_received',
  'price_changed',
  'owner_report_viewed',
  'owner_report_pdf_downloaded'
);

CREATE TABLE property_analytics_events (
  id           UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  UUID                  NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  -- Optional FK to a lead — set when the event is the result of lead capture
  -- or an agent action against a lead.
  lead_id      UUID                  REFERENCES leads(id) ON DELETE SET NULL,
  event_type   property_event_type   NOT NULL,
  -- Where the visitor came from (the property page can split organic vs share)
  source       TEXT,
  -- Cookie-set anonymous id. Lets us count unique visitors and bind a session
  -- of events together without storing PII.
  visitor_id   TEXT,
  session_id   TEXT,
  -- UTM params extracted from the URL when applicable
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,
  -- Extra context (button label, gallery image index, etc.)
  metadata     JSONB                 NOT NULL DEFAULT '{}'::jsonb,
  -- IP hash + UA stored anonymized for bot detection / rate-limiting only.
  ip_hash      TEXT,
  user_agent   TEXT,
  is_bot       BOOLEAN               NOT NULL DEFAULT false,
  -- When the event was captured (server time, not client clock)
  created_at   TIMESTAMPTZ           NOT NULL DEFAULT now()
);

-- Hot indexes for the report aggregation queries.
CREATE INDEX idx_property_events_property_created
  ON property_analytics_events(property_id, created_at DESC)
  WHERE is_bot = false;

CREATE INDEX idx_property_events_property_type
  ON property_analytics_events(property_id, event_type)
  WHERE is_bot = false;

CREATE INDEX idx_property_events_visitor_property
  ON property_analytics_events(property_id, visitor_id)
  WHERE visitor_id IS NOT NULL AND is_bot = false;

CREATE INDEX idx_property_events_lead
  ON property_analytics_events(lead_id)
  WHERE lead_id IS NOT NULL;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE property_analytics_events ENABLE ROW LEVEL SECURITY;

-- Anon + authenticated: write-only via the API route. We do not
-- expose direct INSERT to the JS client because validation +
-- bot filtering + rate limiting must happen server-side.
-- Therefore: NO anon/authenticated INSERT policy here. The route
-- handler uses the admin client (service role) which bypasses RLS.

-- Authenticated property owner / admin: read events for their props.
CREATE POLICY property_events_select_own_or_admin
  ON property_analytics_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_analytics_events.property_id
        AND (
          p.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'owner_admin'
              AND profiles.deleted_at IS NULL
          )
        )
    )
  );
