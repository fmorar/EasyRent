-- ============================================================
-- custom_zones — user-created zone tags
-- ============================================================
--
-- The default Costa Rica zone hierarchy lives in `src/lib/zones.ts`
-- (immutable, code-defined). This table holds **additional**, user-
-- created zone tags so anyone can extend coverage when their region
-- doesn't fit the defaults.
--
-- Codes are auto-generated from the label (snake_cased, prefixed with
-- `custom__` so they never collide with built-in codes). Stored on
-- `profile.zones[]` alongside built-in codes.

CREATE TABLE custom_zones (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT         NOT NULL UNIQUE,
  label       TEXT         NOT NULL,
  created_by  UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_custom_zones_code   ON custom_zones(code) WHERE deleted_at IS NULL;
CREATE INDEX idx_custom_zones_active ON custom_zones(created_at DESC) WHERE deleted_at IS NULL;

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE custom_zones ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can see all custom zones (they're shared
-- across the platform — agent A creating "Heredia - San Rafael"
-- should be visible to agent B's profile picker too).
CREATE POLICY custom_zones_select_all
  ON custom_zones FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Any authenticated user can create new zones.
CREATE POLICY custom_zones_insert_self
  ON custom_zones FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Only the creator (or admin) can soft-delete their own zone.
CREATE POLICY custom_zones_update_own
  ON custom_zones FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin')
  );
