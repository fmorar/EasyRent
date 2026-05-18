-- Visit requests captured by the WhatsApp agent's create_visit_request tool.

CREATE TABLE IF NOT EXISTS visit_requests (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id              UUID         NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  conversation_id      UUID         NULL REFERENCES conversations(id) ON DELETE SET NULL,
  property_id          UUID         NULL REFERENCES properties(id) ON DELETE SET NULL,
  external_listing_id  UUID         NULL REFERENCES external_listings(id) ON DELETE SET NULL,
  preferred_date       TEXT         NULL,
  preferred_time_slot  TEXT         NULL,
  mode                 TEXT         NOT NULL DEFAULT 'in_person',
  status               TEXT         NOT NULL DEFAULT 'pending',
  notes                TEXT         NULL,
  confirmed_at         TIMESTAMPTZ  NULL,
  completed_at         TIMESTAMPTZ  NULL,
  cancelled_at         TIMESTAMPTZ  NULL,
  cancellation_reason  TEXT         NULL,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visit_requests_lead_idx
  ON visit_requests(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS visit_requests_status_idx
  ON visit_requests(status, created_at DESC)
  WHERE status IN ('pending', 'confirmed');
CREATE INDEX IF NOT EXISTS visit_requests_property_idx
  ON visit_requests(property_id)
  WHERE property_id IS NOT NULL;

CREATE TRIGGER visit_requests_set_updated_at
  BEFORE UPDATE ON visit_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE visit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view visit_requests"
  ON visit_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('owner_admin', 'super_admin')
    )
  );

CREATE POLICY "Agents view their own lead's visit_requests"
  ON visit_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = visit_requests.lead_id
        AND leads.assigned_to = auth.uid()
    )
  );

COMMENT ON TABLE visit_requests IS
  'Capture lead-side intent to visit a property. Inserted by the WhatsApp agent when the visit gate is complete. Operators coordinate the actual datetime with the owner separately.';
