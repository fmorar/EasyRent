-- ============================================================
-- profile_zones — agent zone tagging
-- ============================================================
--
-- Adds a free-form TEXT[] column to profiles holding zone codes
-- (see src/lib/zones.ts for the canonical taxonomy).
--
-- Why TEXT[] instead of a junction table:
--   • The taxonomy is small + edited in code, not by users.
--   • Filtering uses array ops (`zones && ARRAY[...]`) which Postgres
--     handles efficiently with a GIN index.
--   • Avoids the read-amplification of joining a tiny lookup table.
--
-- Validation lives in the application layer — TypeScript narrows codes
-- via the `ZoneCode` union; the form picker is a fixed-list checkbox UI.

ALTER TABLE profiles
  ADD COLUMN zones TEXT[] NOT NULL DEFAULT '{}';

-- GIN index for `profile.zones && ARRAY[<codes>]` queries (used by the
-- zone-grouped agent picker).
CREATE INDEX idx_profiles_zones
  ON profiles USING GIN (zones)
  WHERE deleted_at IS NULL;
