-- Pipeline tracking for fully-automated owner outreach.
--
-- When the cron scrapes Encuentra24 and finds high-confidence
-- owners, it creates one row here per (search_request, candidate).
-- The sender tries to fire the Twilio outbound; the inbound webhook
-- routes the owner's reply to the captation agent; the auto-claim
-- helper promotes a consented listing into `properties`.
--
-- Nothing in this table requires human intervention. The admin UI
-- is read-only monitoring.

CREATE TABLE IF NOT EXISTS owner_outreach_attempts (
  id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  search_request_id        UUID         NOT NULL REFERENCES search_requests(id) ON DELETE CASCADE,
  external_listing_id      UUID         NOT NULL REFERENCES external_listings(id) ON DELETE CASCADE,
  conversation_id          UUID         NULL REFERENCES conversations(id) ON DELETE SET NULL,

  target_phone_e164        TEXT         NOT NULL,
  target_name              TEXT         NULL,
  target_role              TEXT         NULL,
  target_confidence        NUMERIC      NULL,

  channel                  TEXT         NOT NULL DEFAULT 'whatsapp',
  template_sid             TEXT         NULL,
  template_variables       JSONB        NULL,
  external_msg_id          TEXT         NULL,

  status                   TEXT         NOT NULL DEFAULT 'queued',

  send_attempts            INTEGER      NOT NULL DEFAULT 0,
  last_error               TEXT         NULL,

  sent_at                  TIMESTAMPTZ  NULL,
  first_response_at        TIMESTAMPTZ  NULL,
  accepted_at              TIMESTAMPTZ  NULL,
  declined_at              TIMESTAMPTZ  NULL,
  claimed_property_id      UUID         NULL REFERENCES properties(id) ON DELETE SET NULL,

  created_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS owner_outreach_attempts_search_phone_uniq
  ON owner_outreach_attempts(search_request_id, target_phone_e164);

CREATE INDEX IF NOT EXISTS owner_outreach_attempts_status_idx
  ON owner_outreach_attempts(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS owner_outreach_attempts_phone_idx
  ON owner_outreach_attempts(target_phone_e164)
  WHERE status IN ('sent', 'responded');

CREATE TRIGGER owner_outreach_attempts_set_updated_at
  BEFORE UPDATE ON owner_outreach_attempts
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE owner_outreach_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view outreach attempts"
  ON owner_outreach_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('owner_admin', 'super_admin')
    )
  );

COMMENT ON TABLE owner_outreach_attempts IS
  'One row per (search_request, candidate) the cron decides to contact. Fully automated lifecycle; admin UI is read-only.';

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'lead';

CREATE INDEX IF NOT EXISTS conversations_kind_idx
  ON conversations(kind)
  WHERE kind = 'owner';

COMMENT ON COLUMN conversations.kind IS
  'lead = the WhatsApp visitor we''re selling to. owner = an outreach target the cron is trying to onboard.';
