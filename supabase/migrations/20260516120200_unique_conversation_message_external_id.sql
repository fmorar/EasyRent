-- WhatsApp concierge: idempotency on Twilio MessageSid.
--
-- Twilio retries failed webhooks (5xx / timeout) up to 11 times over
-- 4 hours. Without uniqueness on external_msg_id we'd save the same
-- inbound message multiple times. The MessageSid is globally unique
-- across Twilio, so a partial unique index on the column (NULL
-- allowed for legacy rows that predate this column) is the cheapest
-- safety net.

CREATE UNIQUE INDEX IF NOT EXISTS conversation_messages_external_msg_id_idx
  ON conversation_messages (external_msg_id)
  WHERE external_msg_id IS NOT NULL;

COMMENT ON INDEX conversation_messages_external_msg_id_idx IS
  'Idempotency on Twilio MessageSid (and any other globally unique id from a future channel). The application catches 23505 on duplicate insert and treats it as already-saved.';
