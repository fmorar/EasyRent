-- ============================================================
-- listing_type — sale vs rent listing intent
-- ============================================================
--
-- Adds a listing-type enum to `properties` so agents can list units
-- for rent in addition to sale. Independent from `status` (which
-- tracks availability: available / reserved / sold / off_market).
--
-- The `price` column is reused — interpreted as the monthly rent
-- when `listing_type = 'rent'`, sale price when `listing_type = 'sale'`.
-- This matches how every Costa Rica real-estate site works (encuentra24,
-- Idealista, etc.) and avoids splitting price into two columns that
-- 99 % of listings only fill one of.

CREATE TYPE listing_type AS ENUM ('sale', 'rent');

ALTER TABLE properties
  ADD COLUMN listing_type listing_type NOT NULL DEFAULT 'sale';

-- Surface listing_type on the public marketplace view so /marketplace
-- + /p/[slug] can render it without an extra query.
DROP VIEW IF EXISTS v_marketplace CASCADE;

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
  p.listing_type,
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

GRANT SELECT ON v_marketplace TO anon, authenticated;

-- The anonymous-link view also exposes listing_type — visitors of
-- unbranded links should see "for rent" / "for sale" too.
DROP VIEW IF EXISTS v_properties_anonymous CASCADE;

CREATE OR REPLACE VIEW v_properties_anonymous
WITH (security_invoker = false)  -- runs as the view owner: postgres
AS
SELECT
  p.id,
  p.title,
  p.description,
  p.price,
  p.currency,
  p.property_type,
  p.listing_type,
  p.status,
  p.bedrooms,
  p.bathrooms,
  p.area_sqm,
  p.floor,
  p.total_floors,
  p.parking_spaces,
  p.location_mode,
  p.display_address,
  p.display_lat,
  p.display_lng,
  p.project_id,
  p.anonymous_slug,
  p.created_at
FROM properties p
WHERE p.anonymous_slug IS NOT NULL
  AND p.deleted_at IS NULL;

GRANT SELECT ON v_properties_anonymous TO anon, authenticated;
