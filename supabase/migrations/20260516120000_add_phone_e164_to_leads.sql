-- WhatsApp concierge phase 2: phone_e164 for lookup by canonical number
--
-- The existing `leads.phone` column is free-form ("8888-8888",
-- "+506 8888 8888", "50688888888" — agents type whatever). When a
-- WhatsApp message arrives, Twilio gives us a canonical E.164 number
-- like "+50688888888"; we need a column we can match against
-- exactly.
--
-- We DO NOT enforce UNIQUE because:
--   • Two different leads could legitimately share a phone (family
--     line, agency switchboard).
--   • Some legacy rows have null/un-normalizable phone — uniquing on
--     a single null-filled column would block the migration.
--
-- A non-unique index is enough for the inbound webhook's
-- "find lead by phone" lookup (1-row hit, indexed scan).
--
-- The application layer (see src/lib/phone.ts) is responsible for
-- normalizing before writing — server-side server actions never
-- accept phone_e164 from the client untrusted.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS phone_e164 TEXT;

CREATE INDEX IF NOT EXISTS leads_phone_e164_idx
  ON leads (phone_e164)
  WHERE phone_e164 IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN leads.phone_e164 IS
  'Canonical E.164 phone number (+50688888888). Used to match inbound WhatsApp messages to existing leads. Populated by application layer; free-form `phone` column stays as the human-readable source.';
