-- ============================================================
-- EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role           AS ENUM ('owner_admin', 'agent');
CREATE TYPE user_status         AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE invitation_status   AS ENUM ('pending', 'accepted', 'expired', 'revoked');
CREATE TYPE property_type       AS ENUM ('apartment', 'house', 'land', 'commercial', 'office', 'warehouse');
CREATE TYPE property_status     AS ENUM ('available', 'reserved', 'sold', 'off_market');
CREATE TYPE location_mode       AS ENUM ('exact', 'approximate');
CREATE TYPE project_status      AS ENUM ('pre_launch', 'under_construction', 'completed', 'on_hold');
CREATE TYPE share_status        AS ENUM ('pending', 'approved', 'rejected', 'revoked');
CREATE TYPE commission_type     AS ENUM ('percentage', 'fixed');
CREATE TYPE project_photo_type  AS ENUM ('hero', 'gallery', 'amenity');
CREATE TYPE lead_source         AS ENUM ('marketplace', 'agent_profile', 'project_page', 'anonymous_link', 'whatsapp', 'direct', 'referral');
CREATE TYPE lead_stage          AS ENUM ('new', 'contacted', 'interested', 'visit_scheduled', 'negotiating', 'contract_requested', 'closed', 'lost');
CREATE TYPE contract_status     AS ENUM ('draft', 'sent', 'signed', 'voided');
CREATE TYPE conversation_status AS ENUM ('open', 'closed', 'pending');
CREATE TYPE message_direction   AS ENUM ('inbound', 'outbound');

-- ============================================================
-- PROFILES
-- ============================================================

CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        user_role    NOT NULL DEFAULT 'agent',
  status      user_status  NOT NULL DEFAULT 'active',
  full_name   TEXT         NOT NULL,
  slug        TEXT         NOT NULL UNIQUE,
  email       TEXT         NOT NULL UNIQUE,
  phone       TEXT,
  bio         TEXT,
  avatar_url  TEXT,
  invited_by  UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_profiles_slug   ON profiles(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_role   ON profiles(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_status ON profiles(status);

-- ============================================================
-- INVITATIONS
-- ============================================================

CREATE TABLE invitations (
  id          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT             NOT NULL,
  token       TEXT             NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  invited_by  UUID             NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        user_role        NOT NULL DEFAULT 'agent',
  status      invitation_status NOT NULL DEFAULT 'pending',
  expires_at  TIMESTAMPTZ      NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID             REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ      NOT NULL DEFAULT now()
);

CREATE INDEX idx_invitations_token  ON invitations(token);
CREATE INDEX idx_invitations_status ON invitations(status);

-- ============================================================
-- PROJECTS
-- ============================================================

CREATE TABLE projects (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by          UUID           NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title               TEXT           NOT NULL,
  slug                TEXT           NOT NULL UNIQUE,
  description         TEXT,
  developer_name      TEXT,
  location_label      TEXT,
  total_units         INTEGER,
  available_units     INTEGER,
  completion_date     DATE,
  status              project_status NOT NULL DEFAULT 'under_construction',
  is_master_template  BOOLEAN        NOT NULL DEFAULT false,
  is_active           BOOLEAN        NOT NULL DEFAULT true,
  forked_from         UUID           REFERENCES projects(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_projects_slug       ON projects(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_created_by ON projects(created_by) WHERE deleted_at IS NULL;

-- ============================================================
-- PROJECT PHOTOS
-- ============================================================

CREATE TABLE project_photos (
  id          UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID              NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  url         TEXT              NOT NULL,
  storage_path TEXT,
  type        project_photo_type NOT NULL DEFAULT 'gallery',
  is_cover    BOOLEAN           NOT NULL DEFAULT false,
  order_index INTEGER           NOT NULL DEFAULT 0,
  caption     TEXT,
  created_at  TIMESTAMPTZ       NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_photos_project ON project_photos(project_id);

-- ============================================================
-- PROJECT AMENITIES
-- ============================================================

CREATE TABLE project_amenities (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  icon        TEXT,
  sort_order  INTEGER     NOT NULL DEFAULT 0
);

CREATE INDEX idx_project_amenities_project ON project_amenities(project_id);

-- ============================================================
-- PROPERTIES
-- ============================================================

CREATE TABLE properties (
  id                    UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by            UUID            NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id            UUID            REFERENCES projects(id) ON DELETE SET NULL,
  title                 TEXT            NOT NULL,
  slug                  TEXT            NOT NULL UNIQUE,
  description           TEXT,
  price                 NUMERIC(15,2)   NOT NULL,
  currency              TEXT            NOT NULL DEFAULT 'USD',
  property_type         property_type   NOT NULL,
  status                property_status NOT NULL DEFAULT 'available',
  bedrooms              INTEGER,
  bathrooms             INTEGER,
  area_sqm              NUMERIC(10,2),
  floor                 INTEGER,
  total_floors          INTEGER,
  parking_spaces        INTEGER,
  -- Location
  location_mode         location_mode   NOT NULL DEFAULT 'approximate',
  public_address        TEXT,
  exact_address         TEXT,
  display_address       TEXT,
  exact_lat             NUMERIC(10,7),
  exact_lng             NUMERIC(10,7),
  display_lat           NUMERIC(10,7),
  display_lng           NUMERIC(10,7),
  -- Flags
  is_featured           BOOLEAN         NOT NULL DEFAULT false,
  is_marketplace_visible BOOLEAN        NOT NULL DEFAULT false,
  anonymous_slug        TEXT            UNIQUE,
  -- Meta
  created_at            TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ     NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_properties_created_by  ON properties(created_by) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_slug        ON properties(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_anon_slug   ON properties(anonymous_slug) WHERE anonymous_slug IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_properties_marketplace ON properties(is_marketplace_visible) WHERE is_marketplace_visible = true AND deleted_at IS NULL;

-- ============================================================
-- PROPERTY OWNERS
-- ============================================================

CREATE TABLE property_owners (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  profile_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_primary  BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, profile_id)
);

-- ============================================================
-- PROPERTY PHOTOS
-- ============================================================

CREATE TABLE property_photos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  url          TEXT        NOT NULL,
  storage_path TEXT,
  is_cover     BOOLEAN     NOT NULL DEFAULT false,
  order_index  INTEGER     NOT NULL DEFAULT 0,
  caption      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_property_photos_property ON property_photos(property_id);

-- ============================================================
-- PROPERTY SHARES
-- Contextual publication model: each share = a listing under
-- the recipient's identity. public_contact_user_id always = shared_with.
-- ============================================================

CREATE TABLE property_shares (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id           UUID          NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  shared_by             UUID          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shared_with           UUID          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  public_contact_user_id UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status                share_status  NOT NULL DEFAULT 'pending',
  commission_type       commission_type,
  commission_value      NUMERIC(10,2),
  notes                 TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ,
  CONSTRAINT chk_contact_is_recipient CHECK (public_contact_user_id = shared_with)
);

-- Partial unique index: only one active share per property+recipient at a time.
-- Allows re-sharing after revocation (deleted_at IS NOT NULL rows are ignored).
CREATE UNIQUE INDEX uniq_active_share
  ON property_shares(property_id, shared_with)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_property_shares_property   ON property_shares(property_id);
CREATE INDEX idx_property_shares_shared_with ON property_shares(shared_with) WHERE deleted_at IS NULL;

-- ============================================================
-- LEADS
-- ============================================================

CREATE TABLE leads (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID        REFERENCES properties(id) ON DELETE SET NULL,
  project_id      UUID        REFERENCES projects(id) ON DELETE SET NULL,
  full_name       TEXT        NOT NULL,
  email           TEXT,
  phone           TEXT,
  source          lead_source NOT NULL DEFAULT 'direct',
  source_context  TEXT        CHECK (char_length(source_context) <= 255),
  stage           lead_stage  NOT NULL DEFAULT 'new',
  assigned_to     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  captured_by     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  notes           TEXT,
  is_archived     BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_leads_assigned_to ON leads(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_stage       ON leads(stage) WHERE deleted_at IS NULL AND is_archived = false;
CREATE INDEX idx_leads_property    ON leads(property_id) WHERE deleted_at IS NULL;

-- ============================================================
-- LEAD STATUS HISTORY
-- ============================================================

CREATE TABLE lead_status_history (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  changed_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  from_stage  lead_stage,
  to_stage    lead_stage  NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_history_lead ON lead_status_history(lead_id);

-- ============================================================
-- CONTRACT TEMPLATES
-- ============================================================

CREATE TABLE contract_templates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  body_html   TEXT        NOT NULL,
  variables   JSONB       NOT NULL DEFAULT '[]',
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

-- ============================================================
-- CONTRACTS
-- ============================================================

CREATE TABLE contracts (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID            NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  template_id     UUID            REFERENCES contract_templates(id) ON DELETE SET NULL,
  created_by      UUID            NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status          contract_status NOT NULL DEFAULT 'draft',
  document_url    TEXT,
  storage_path    TEXT,
  variables_data  JSONB,
  signed_at       TIMESTAMPTZ,
  voided_at       TIMESTAMPTZ,
  voided_reason   TEXT,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_contracts_lead ON contracts(lead_id);

-- ============================================================
-- CONVERSATIONS
-- ============================================================

CREATE TABLE conversations (
  id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID                REFERENCES leads(id) ON DELETE SET NULL,
  channel         TEXT                NOT NULL DEFAULT 'whatsapp',
  external_id     TEXT,
  status          conversation_status NOT NULL DEFAULT 'open',
  assigned_to     UUID                REFERENCES profiles(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ         NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ         NOT NULL DEFAULT now()
);

-- ============================================================
-- CONVERSATION MESSAGES
-- ============================================================

CREATE TABLE conversation_messages (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID              NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction       message_direction NOT NULL,
  content         TEXT              NOT NULL,
  media_url       TEXT,
  external_msg_id TEXT,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT now()
);

CREATE INDEX idx_conv_messages_conversation ON conversation_messages(conversation_id);

-- ============================================================
-- SECURITY DEFINER HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'owner_admin'
      AND deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM profiles WHERE id = auth.uid() AND deleted_at IS NULL;
$$;

-- ============================================================
-- HANDLE NEW USER TRIGGER
-- Creates a profile row when a new auth.users row is inserted.
-- Admin uses createUser() and passes metadata for full_name, role, slug.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_full_name TEXT;
  v_role      user_role;
  v_slug      TEXT;
  v_email     TEXT;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_role      := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'agent');
  v_email     := COALESCE(NEW.email, NEW.raw_user_meta_data->>'email');
  v_slug      := COALESCE(
    NEW.raw_user_meta_data->>'slug',
    lower(regexp_replace(v_full_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substring(NEW.id::text, 1, 6)
  );

  INSERT INTO profiles (id, full_name, slug, email, role)
  VALUES (NEW.id, v_full_name, v_slug, v_email, v_role)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- UPDATED_AT TRIGGER HELPER
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at        BEFORE UPDATE ON profiles        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_projects_updated_at        BEFORE UPDATE ON projects        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_properties_updated_at      BEFORE UPDATE ON properties      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_property_shares_updated_at BEFORE UPDATE ON property_shares FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_leads_updated_at           BEFORE UPDATE ON leads           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_contracts_updated_at       BEFORE UPDATE ON contracts       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_conversations_updated_at   BEFORE UPDATE ON conversations   FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- LEAD STATUS HISTORY AUTO-INSERT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION record_lead_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO lead_status_history (lead_id, changed_by, from_stage, to_stage)
    VALUES (NEW.id, NEW.captured_by, NULL, NEW.stage);
  ELSIF TG_OP = 'UPDATE' AND OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO lead_status_history (lead_id, changed_by, from_stage, to_stage)
    VALUES (NEW.id, auth.uid(), OLD.stage, NEW.stage);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lead_stage_history
  AFTER INSERT OR UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION record_lead_stage_change();

-- ============================================================
-- MARKETPLACE VISIBILITY TRIGGER
-- is_marketplace_visible = true when the property has an
-- approved share where shared_with = owner_admin profile.
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_marketplace_visibility()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_property_id UUID;
BEGIN
  v_property_id := COALESCE(NEW.property_id, OLD.property_id);

  UPDATE properties
  SET is_marketplace_visible = EXISTS (
    SELECT 1
    FROM property_shares ps
    JOIN profiles p ON p.id = ps.shared_with AND p.role = 'owner_admin'
    WHERE ps.property_id = v_property_id
      AND ps.status = 'approved'
      AND ps.deleted_at IS NULL
  )
  WHERE id = v_property_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_marketplace_visibility_on_share
  AFTER INSERT OR UPDATE OR DELETE ON property_shares
  FOR EACH ROW EXECUTE FUNCTION refresh_marketplace_visibility();

-- Also refresh when a property is first inserted
CREATE OR REPLACE FUNCTION init_marketplace_visibility()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.is_marketplace_visible := false;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_init_marketplace_visibility
  BEFORE INSERT ON properties
  FOR EACH ROW EXECUTE FUNCTION init_marketplace_visibility();

-- ============================================================
-- DB FUNCTION: get_agent_profile_properties
-- Returns own properties + approved shares for an agent's public profile.
-- ============================================================

CREATE OR REPLACE FUNCTION get_agent_profile_properties(p_agent_id UUID)
RETURNS TABLE (
  property_id     UUID,
  title           TEXT,
  description     TEXT,
  price           NUMERIC,
  currency        TEXT,
  property_type   property_type,
  status          property_status,
  bedrooms        INTEGER,
  bathrooms       INTEGER,
  area_sqm        NUMERIC,
  floor           INTEGER,
  display_address TEXT,
  display_lat     NUMERIC,
  display_lng     NUMERIC,
  cover_url       TEXT,
  contact_user_id UUID,
  is_own          BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  -- Own properties
  SELECT
    p.id,
    p.title,
    p.description,
    p.price,
    p.currency,
    p.property_type,
    p.status,
    p.bedrooms,
    p.bathrooms,
    p.area_sqm,
    p.floor,
    p.display_address,
    p.display_lat,
    p.display_lng,
    (SELECT url FROM property_photos ph WHERE ph.property_id = p.id AND ph.is_cover = true LIMIT 1) AS cover_url,
    p_agent_id AS contact_user_id,
    true AS is_own
  FROM properties p
  WHERE p.created_by = p_agent_id
    AND p.deleted_at IS NULL
    AND p.status != 'off_market'

  UNION ALL

  -- Approved shares
  SELECT
    p.id,
    p.title,
    p.description,
    p.price,
    p.currency,
    p.property_type,
    p.status,
    p.bedrooms,
    p.bathrooms,
    p.area_sqm,
    p.floor,
    p.display_address,
    p.display_lat,
    p.display_lng,
    (SELECT url FROM property_photos ph WHERE ph.property_id = p.id AND ph.is_cover = true LIMIT 1) AS cover_url,
    ps.public_contact_user_id AS contact_user_id,
    false AS is_own
  FROM property_shares ps
  JOIN properties p ON p.id = ps.property_id
  WHERE ps.shared_with = p_agent_id
    AND ps.status = 'approved'
    AND ps.deleted_at IS NULL
    AND p.deleted_at IS NULL
    AND p.status != 'off_market';
$$;

-- ============================================================
-- VIEWS
-- ============================================================

-- Marketplace public view (only visible properties)
CREATE OR REPLACE VIEW v_marketplace
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.slug,
  p.title,
  p.description,
  p.price,
  p.currency,
  p.property_type,
  p.status,
  p.bedrooms,
  p.bathrooms,
  p.area_sqm,
  p.floor,
  p.is_featured,
  p.project_id,
  p.display_address,
  p.display_lat,
  p.display_lng,
  p.created_at
FROM properties p
WHERE p.is_marketplace_visible = true
  AND p.deleted_at IS NULL
  AND p.status != 'off_market';

-- Anonymous link view — strips all identity fields
-- Views run as the view owner (security definer) by default.
CREATE OR REPLACE VIEW v_properties_anonymous
AS
SELECT
  p.id,
  p.anonymous_slug,
  p.title,
  p.description,
  p.price,
  p.currency,
  p.property_type,
  p.status,
  p.bedrooms,
  p.bathrooms,
  p.area_sqm,
  p.floor,
  p.total_floors,
  p.parking_spaces,
  p.display_address,
  p.display_lat,
  p.display_lng,
  p.location_mode,
  p.project_id,
  p.created_at
FROM properties p
WHERE p.anonymous_slug IS NOT NULL
  AND p.deleted_at IS NULL;

-- ============================================================
-- GRANTS
-- anon can SELECT properties (RLS restricts to marketplace-visible rows)
-- and the two public views.
-- ============================================================

GRANT SELECT ON properties TO anon;
GRANT SELECT ON v_marketplace TO anon, authenticated;
GRANT SELECT ON v_properties_anonymous TO anon, authenticated;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_photos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_amenities   ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties          ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_owners     ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_photos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_shares     ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads               ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- ── profiles ──────────────────────────────────────────────
CREATE POLICY "profiles: read own or admin reads all"
  ON profiles FOR SELECT
  USING (id = auth.uid() OR is_admin());

CREATE POLICY "profiles: update own"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- ── invitations ───────────────────────────────────────────
CREATE POLICY "invitations: admin full access"
  ON invitations FOR ALL
  USING (is_admin());

CREATE POLICY "invitations: read own token (accept flow)"
  ON invitations FOR SELECT
  USING (true); -- token lookup is done server-side with admin client

-- ── projects ──────────────────────────────────────────────
CREATE POLICY "projects: read all active"
  ON projects FOR SELECT
  USING (deleted_at IS NULL AND is_active = true);

CREATE POLICY "projects: admin insert/update/delete"
  ON projects FOR ALL
  USING (is_admin());

CREATE POLICY "projects: agent manages own non-template"
  ON projects FOR ALL
  USING (
    created_by = auth.uid()
    AND is_master_template = false
    AND deleted_at IS NULL
  );

-- ── project_photos ────────────────────────────────────────
CREATE POLICY "project_photos: read all"
  ON project_photos FOR SELECT USING (true);

CREATE POLICY "project_photos: write via project ownership"
  ON project_photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE id = project_id
        AND (created_by = auth.uid() OR is_admin())
        AND deleted_at IS NULL
    )
  );

-- ── project_amenities ─────────────────────────────────────
CREATE POLICY "project_amenities: read all"
  ON project_amenities FOR SELECT USING (true);

CREATE POLICY "project_amenities: write via project ownership"
  ON project_amenities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE id = project_id
        AND (created_by = auth.uid() OR is_admin())
        AND deleted_at IS NULL
    )
  );

-- ── properties ────────────────────────────────────────────
-- anon: can see marketplace-visible rows (queried through v_marketplace view)
CREATE POLICY "properties: public marketplace read"
  ON properties FOR SELECT
  TO anon
  USING (
    is_marketplace_visible = true
    AND deleted_at IS NULL
    AND status <> 'off_market'::property_status
  );

-- authenticated: see own + shared-with-them.
CREATE POLICY "properties: owner or admin reads all"
  ON properties FOR SELECT
  USING (
    is_admin()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM property_shares ps
      WHERE ps.property_id = id
        AND ps.shared_with = auth.uid()
        AND ps.status = 'approved'
        AND ps.deleted_at IS NULL
    )
  );

CREATE POLICY "properties: owner or admin write"
  ON properties FOR INSERT
  WITH CHECK (created_by = auth.uid() OR is_admin());

CREATE POLICY "properties: owner or admin update"
  ON properties FOR UPDATE
  USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "properties: owner or admin delete"
  ON properties FOR DELETE
  USING (created_by = auth.uid() OR is_admin());

-- ── property_owners ───────────────────────────────────────
CREATE POLICY "property_owners: read all authenticated"
  ON property_owners FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "property_owners: admin full access"
  ON property_owners FOR ALL
  USING (is_admin());

-- ── property_photos ───────────────────────────────────────
CREATE POLICY "property_photos: read if can read property"
  ON property_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_id
        AND (
          p.is_marketplace_visible
          OR p.created_by = auth.uid()
          OR is_admin()
          OR EXISTS (
            SELECT 1 FROM property_shares ps
            WHERE ps.property_id = p.id
              AND ps.shared_with = auth.uid()
              AND ps.status = 'approved'
              AND ps.deleted_at IS NULL
          )
        )
    )
  );

CREATE POLICY "property_photos: write via property ownership"
  ON property_photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_id
        AND (p.created_by = auth.uid() OR is_admin())
    )
  );

-- ── property_shares ───────────────────────────────────────
CREATE POLICY "property_shares: admin sees all"
  ON property_shares FOR SELECT
  USING (is_admin());

CREATE POLICY "property_shares: agent sees own shares"
  ON property_shares FOR SELECT
  USING (shared_by = auth.uid() OR shared_with = auth.uid());

CREATE POLICY "property_shares: owner can share own property"
  ON property_shares FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_id AND p.created_by = auth.uid()
    )
  );

CREATE POLICY "property_shares: admin can review (update status)"
  ON property_shares FOR UPDATE
  USING (is_admin());

CREATE POLICY "property_shares: owner can revoke own share"
  ON property_shares FOR UPDATE
  USING (shared_by = auth.uid());

-- ── leads ─────────────────────────────────────────────────
CREATE POLICY "leads: admin sees all"
  ON leads FOR SELECT
  USING (is_admin());

CREATE POLICY "leads: agent sees assigned or captured unassigned"
  ON leads FOR SELECT
  USING (
    assigned_to = auth.uid()
    OR (captured_by = auth.uid() AND assigned_to IS NULL)
  );

CREATE POLICY "leads: insert via server action (authenticated)"
  ON leads FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR is_admin());

CREATE POLICY "leads: update assigned or admin"
  ON leads FOR UPDATE
  USING (assigned_to = auth.uid() OR is_admin());

-- ── lead_status_history ───────────────────────────────────
CREATE POLICY "lead_history: read if can read lead"
  ON lead_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leads l WHERE l.id = lead_id
        AND (l.assigned_to = auth.uid() OR is_admin())
    )
  );

CREATE POLICY "lead_history: insert via trigger only"
  ON lead_status_history FOR INSERT
  WITH CHECK (true); -- controlled by SECURITY DEFINER trigger

-- ── contract_templates ────────────────────────────────────
CREATE POLICY "contract_templates: admin full access"
  ON contract_templates FOR ALL
  USING (is_admin());

CREATE POLICY "contract_templates: agents read active"
  ON contract_templates FOR SELECT
  USING (is_active = true AND deleted_at IS NULL);

-- ── contracts ─────────────────────────────────────────────
CREATE POLICY "contracts: admin full access"
  ON contracts FOR ALL
  USING (is_admin());

CREATE POLICY "contracts: agent reads own created"
  ON contracts FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "contracts: agent creates"
  ON contracts FOR INSERT
  WITH CHECK (created_by = auth.uid() OR is_admin());

-- ── conversations ─────────────────────────────────────────
CREATE POLICY "conversations: admin full access"
  ON conversations FOR ALL
  USING (is_admin());

CREATE POLICY "conversations: agent sees assigned"
  ON conversations FOR SELECT
  USING (assigned_to = auth.uid());

-- ── conversation_messages ─────────────────────────────────
CREATE POLICY "conv_messages: read via conversation access"
  ON conversation_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c WHERE c.id = conversation_id
        AND (c.assigned_to = auth.uid() OR is_admin())
    )
  );

CREATE POLICY "conv_messages: insert via conversation access"
  ON conversation_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c WHERE c.id = conversation_id
        AND (c.assigned_to = auth.uid() OR is_admin())
    )
  );

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('property-photos',  'property-photos',  true,  10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('project-photos',   'project-photos',   true,  10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('avatars',          'avatars',          true,  5242880,  ARRAY['image/jpeg','image/png','image/webp']),
  ('contracts',        'contracts',        false, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "property-photos: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'property-photos');

CREATE POLICY "property-photos: authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'property-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "property-photos: owner delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'property-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "project-photos: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-photos');

CREATE POLICY "project-photos: authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'project-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "avatars: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars: own upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

CREATE POLICY "avatars: own update/delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "contracts: owner or admin read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'contracts'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR is_admin()
    )
  );

CREATE POLICY "contracts: authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'contracts' AND auth.uid() IS NOT NULL);
