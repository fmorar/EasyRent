-- External (scraped) listings the WhatsApp concierge can offer when
-- our own catalog has no match for a lead's filters.
--
-- Why a dedicated table (not `properties`):
--   • `properties` requires `created_by` (a real profile uuid), an
--     owner contract, slug uniqueness across the public marketplace,
--     and a bunch of business rules around publishing. External
--     listings have NONE of those — they're cold leads from
--     third-party sites, owned by someone we haven't met.
--   • Keeping them separate means the public marketplace stays
--     "things we represent", while the agent can still surface
--     Encuentra24 etc. as conversational suggestions.
--   • The `claim` columns make a future workflow obvious: an admin
--     reaches out to the owner, signs them, then this row gets
--     promoted into `properties` properly.

CREATE TABLE IF NOT EXISTS external_listings (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Where it came from
  source_name      TEXT         NOT NULL,                -- 'encuentra24'
  source_url       TEXT         NOT NULL,                -- absolute URL of the detail page
  source_id        TEXT         NULL,                    -- the platform's own id, when we can parse it

  -- Searchable fields, normalized
  title            TEXT         NOT NULL,
  description      TEXT         NULL,
  price            NUMERIC      NULL,                    -- nullable: not every scrape has a clean price
  currency         TEXT         NULL,                    -- 'USD' | 'CRC' | NULL
  listing_type     listing_type NULL,                    -- reuse our enum
  property_type    property_type NULL,
  bedrooms         INTEGER      NULL,
  bathrooms        INTEGER      NULL,
  area_sqm         NUMERIC      NULL,
  location_text    TEXT         NULL,                    -- free text like "Escazú, San José"
  is_furnished     BOOLEAN      NULL,                    -- often unknown from card view

  -- Provenance / refresh tracking
  raw_extracted    JSONB        NULL,                    -- full CrawledListing for debugging
  advertiser       JSONB        NULL,                    -- { name, role, phone, profile_url } when enrichment ran
  scraped_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  last_seen_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),  -- bumped on every successful re-scrape; lets us age stale listings out

  -- Claim workflow — admins promote a cold listing to a real
  -- `properties` row once they've signed the owner.
  is_claimed       BOOLEAN      NOT NULL DEFAULT FALSE,
  claimed_by       UUID         NULL REFERENCES profiles(id) ON DELETE SET NULL,
  claimed_at       TIMESTAMPTZ  NULL,
  claimed_property_id UUID      NULL REFERENCES properties(id) ON DELETE SET NULL,

  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,   -- soft-delete; set false when the source page returns 404
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- The detail URL is the natural key — re-scraping the same page
-- updates instead of inserting a duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS external_listings_source_url_uniq
  ON external_listings(source_url);

-- Lookups by listing_type + location text are the most common search
-- shape (the agent passes "rent" + zone).
CREATE INDEX IF NOT EXISTS external_listings_listing_type_idx
  ON external_listings(listing_type)
  WHERE is_active = TRUE;

-- Age-out / "what's fresh enough to show" queries.
CREATE INDEX IF NOT EXISTS external_listings_last_seen_idx
  ON external_listings(last_seen_at DESC)
  WHERE is_active = TRUE;

-- updated_at auto-bump trigger to mirror what other tables do.
CREATE TRIGGER external_listings_set_updated_at
  BEFORE UPDATE ON external_listings
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- RLS: read open to admins, writes happen via service_role (admin
-- client inside the WhatsApp webhook + future cron jobs).
ALTER TABLE external_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view external listings"
  ON external_listings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('owner_admin', 'super_admin')
    )
  );

COMMENT ON TABLE external_listings IS
  'Scraped listings the WhatsApp concierge offers when our own catalog has no match. Written by the webhook (service_role), read by admins. Promote to `properties` via the claim columns when an owner signs with easyrent.';
