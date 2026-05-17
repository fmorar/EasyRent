-- WhatsApp concierge phase 2: unique conversation per (channel, external_id)
--
-- The `conversations` table already has `channel` (default 'whatsapp')
-- and `external_id` (TEXT). For WhatsApp we set
-- external_id = lead's E.164 phone, so each (whatsapp, phone) pair
-- identifies exactly one persistent thread.
--
-- A partial unique index gives us:
--   • Fast lookup by external_id when an inbound webhook arrives
--   • Database-level guarantee that we won't accidentally create two
--     conversation rows for the same phone — a race condition would
--     fail loudly instead of silently splitting the thread
--   • Allows multiple rows with NULL external_id (e.g. older
--     conversations created before this column was wired)
--   • Allows soft-deleted rows to coexist with new ones

CREATE UNIQUE INDEX IF NOT EXISTS conversations_external_id_channel_idx
  ON conversations (channel, external_id)
  WHERE external_id IS NOT NULL;

COMMENT ON INDEX conversations_external_id_channel_idx IS
  'One active conversation per (channel, external_id). For WhatsApp, external_id is the lead phone in E.164. Partial: NULL external_id rows are allowed (legacy threads created before this column was wired).';
