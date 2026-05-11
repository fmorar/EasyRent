
-- ── owners ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS owners (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name   text        NOT NULL,
  phone       text,
  email       text,
  id_number   text,
  notes       text,
  created_by  uuid        NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_owners_created_by ON owners (created_by);
CREATE INDEX IF NOT EXISTS idx_owners_full_name  ON owners USING gin (to_tsvector('simple', full_name));

CREATE TRIGGER trg_owners_updated_at
  BEFORE UPDATE ON owners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE owners ENABLE ROW LEVEL SECURITY;

-- Only authenticated admins/agents can manage owners
CREATE POLICY "auth users full access on owners"
  ON owners FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── Link owners → properties ───────────────────────────────────
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES owners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON properties (owner_id);
