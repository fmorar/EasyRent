-- Owner-intake leads — property owners who want to LIST with us.
--
-- Lives separate from the main `leads` table because:
--   • These are not buyer/renter intent → they don't move through the
--     sales pipeline (new → contacted → visit → close).
--   • They carry property metadata (type, zone, m², asking price)
--     which doesn't fit the buyer-lead shape.
--   • The team's follow-up is different — qualify, schedule valuation,
--     onboard or politely decline.
--
-- Status lifecycle (own enum):
--   new → contacted → valuation_scheduled →
--      (listed | declined | nurturing)

CREATE TYPE owner_lead_intent  AS ENUM ('sale', 'rent', 'both');
CREATE TYPE owner_lead_status  AS ENUM (
  'new', 'contacted', 'valuation_scheduled',
  'listed', 'declined', 'nurturing'
);

CREATE TABLE IF NOT EXISTS public.owner_leads (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contact
  full_name       TEXT        NOT NULL,
  phone           TEXT        NOT NULL,
  email           TEXT,

  -- Intent
  intent          owner_lead_intent NOT NULL,

  -- Property snapshot (free-form / unverified at intake)
  property_type   TEXT,                              -- apartment / house / land / commercial / office / warehouse
  zone            TEXT,                              -- "San Rafael de Escazú" — whatever they wrote
  bedrooms        INTEGER     CHECK (bedrooms   IS NULL OR bedrooms   BETWEEN 0 AND 50),
  bathrooms       NUMERIC(4,1) CHECK (bathrooms  IS NULL OR bathrooms  BETWEEN 0 AND 50),
  area_sqm        NUMERIC(10,2) CHECK (area_sqm  IS NULL OR area_sqm   > 0),
  expected_price  NUMERIC(14,2) CHECK (expected_price IS NULL OR expected_price > 0),
  currency        TEXT        CHECK (currency IS NULL OR currency IN ('USD', 'CRC')),

  -- Free-text
  message         TEXT        CHECK (message IS NULL OR char_length(message) <= 2000),

  -- Where they came from (path / utm / referrer). Same conventions as
  -- newsletter_subscribers + leads.source_context.
  source_context  TEXT        CHECK (source_context IS NULL OR char_length(source_context) <= 255),
  locale          TEXT        NOT NULL DEFAULT 'es',

  -- Pipeline
  status          owner_lead_status NOT NULL DEFAULT 'new',
  assigned_to     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  notes           TEXT,                              -- internal notes, written by admin

  -- Timestamps + soft-delete
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

-- Hot lookups: open leads ordered by recency.
CREATE INDEX IF NOT EXISTS idx_owner_leads_status_created
  ON public.owner_leads (status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_owner_leads_assigned
  ON public.owner_leads (assigned_to)
  WHERE deleted_at IS NULL;

-- Auto-bump `updated_at` on every UPDATE.
CREATE OR REPLACE FUNCTION public.touch_owner_leads_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS owner_leads_set_updated_at ON public.owner_leads;
CREATE TRIGGER owner_leads_set_updated_at
  BEFORE UPDATE ON public.owner_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_owner_leads_updated_at();

-- ── RLS ────────────────────────────────────────────────────────
-- Public visitors can INSERT (submit the form). Reading + updating
-- is admin-only — the team triages and updates from the dashboard.
-- The server action uses the admin client anyway; these policies
-- are belt-and-suspenders.

ALTER TABLE public.owner_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_leads: public can submit"
  ON public.owner_leads;
CREATE POLICY "owner_leads: public can submit"
  ON public.owner_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "owner_leads: admin reads all"
  ON public.owner_leads;
CREATE POLICY "owner_leads: admin reads all"
  ON public.owner_leads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'owner_admin'
        AND p.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "owner_leads: admin updates"
  ON public.owner_leads;
CREATE POLICY "owner_leads: admin updates"
  ON public.owner_leads
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'owner_admin'
        AND p.deleted_at IS NULL
    )
  );

COMMENT ON TABLE public.owner_leads IS
  'Property owners who want to list (sale/rent) with the agency. Captured via the public /contacto page. Separate from `leads` (buyer/renter pipeline).';
