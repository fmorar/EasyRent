-- Tracking table for "search now, follow up later" jobs.
--
-- Created by the WhatsApp agent when both the internal catalog AND
-- the inline Encuentra24 fallback return zero hits. The bot replies
-- "te aviso máx 24h" and a background cron picks the row up to do a
-- deeper scrape (more pages, advertiser enrichment) without blocking
-- the webhook turn.

CREATE TABLE IF NOT EXISTS search_requests (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             UUID         NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  conversation_id     UUID         NULL REFERENCES conversations(id) ON DELETE SET NULL,

  -- The exact AgentSearchInput we tried. Stored so the cron can
  -- replay it without re-deriving from the conversation history.
  filters             JSONB        NOT NULL,

  -- Lifecycle:
  --   pending    — created by the bot, cron hasn't picked it up yet
  --   scraping   — cron is actively re-scraping with enrichment
  --   completed  — scrape done, candidates landed in external_listings
  --   fulfilled  — a candidate was contacted, owner agreed, lead notified
  --   failed     — scrape errored hard / no candidates after N retries
  --   expired    — expired_at passed without fulfillment
  status              TEXT         NOT NULL DEFAULT 'pending',

  scrape_attempts     INTEGER      NOT NULL DEFAULT 0,
  candidates_count    INTEGER      NOT NULL DEFAULT 0,

  -- True once we've sent the lead a follow-up message about results.
  -- Prevents re-spamming on every cron tick.
  contacted_lead      BOOLEAN      NOT NULL DEFAULT FALSE,

  -- When a search succeeds and gets matched to a real property
  -- (either an owner consented to publish via the cold outreach flow,
  -- or a manual admin claimed an external_listing), set this.
  fulfilled_property_id          UUID NULL REFERENCES properties(id) ON DELETE SET NULL,
  fulfilled_external_listing_id  UUID NULL REFERENCES external_listings(id) ON DELETE SET NULL,
  fulfilled_at                   TIMESTAMPTZ NULL,

  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  scraped_at          TIMESTAMPTZ  NULL,
  -- Auto-stop trying after a week. Searches older than this get
  -- skipped by the cron and surface in the dashboard as "expired".
  expired_at          TIMESTAMPTZ  NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS search_requests_pickup_idx
  ON search_requests(status, expired_at)
  WHERE status IN ('pending', 'scraping');

CREATE INDEX IF NOT EXISTS search_requests_lead_id_idx
  ON search_requests(lead_id, created_at DESC);

CREATE TRIGGER search_requests_set_updated_at
  BEFORE UPDATE ON search_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE search_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view search_requests"
  ON search_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('owner_admin', 'super_admin')
    )
  );

COMMENT ON TABLE search_requests IS
  'Open follow-ups created when the WhatsApp concierge has nothing to offer. The cron job re-scrapes and the matching loop circles back to the lead when candidates surface.';
