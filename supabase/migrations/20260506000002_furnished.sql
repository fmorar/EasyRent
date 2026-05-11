-- ============================================================
-- is_furnished — relevant for rentals, optional on sales
-- ============================================================
--
-- "Amueblado" is one of the top filters on Costa Rica rental sites.
-- Stored as a boolean on every property; the UI only surfaces it when
-- `listing_type = 'rent'` since it rarely matters for sales (you take
-- the furniture you want or none at all when buying).

ALTER TABLE properties
  ADD COLUMN is_furnished BOOLEAN NOT NULL DEFAULT false;

-- Surface on the public marketplace + anonymous views so the marketplace
-- filter and the property pages can read it without an extra round-trip.
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
  p.is_furnished,
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

DROP VIEW IF EXISTS v_properties_anonymous CASCADE;

CREATE OR REPLACE VIEW v_properties_anonymous
WITH (security_invoker = false)
AS
SELECT
  p.id,
  p.title,
  p.description,
  p.price,
  p.currency,
  p.property_type,
  p.listing_type,
  p.is_furnished,
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

-- Update the agent profile RPC too — same reason.
DROP FUNCTION IF EXISTS public.get_agent_profile_properties(uuid);

CREATE FUNCTION public.get_agent_profile_properties(p_agent_id uuid)
RETURNS TABLE(
  property_id      uuid,
  slug             text,
  title            text,
  description      text,
  price            numeric,
  currency         text,
  property_type    property_type,
  listing_type     listing_type,
  is_furnished     boolean,
  status           property_status,
  bedrooms         integer,
  bathrooms        integer,
  area_sqm         numeric,
  floor            integer,
  display_address  text,
  display_lat      numeric,
  display_lng      numeric,
  cover_url        text,
  contact_user_id  uuid,
  is_own           boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    p.id, p.slug, p.title, p.description, p.price, p.currency, p.property_type,
    p.listing_type, p.is_furnished, p.status, p.bedrooms, p.bathrooms, p.area_sqm, p.floor,
    p.display_address, p.display_lat, p.display_lng,
    (SELECT url FROM property_photos ph WHERE ph.property_id = p.id AND ph.is_cover = true LIMIT 1),
    p_agent_id, true
  FROM properties p
  WHERE p.created_by = p_agent_id
    AND p.deleted_at IS NULL
    AND p.status != 'off_market'

  UNION ALL

  SELECT
    p.id, p.slug, p.title, p.description, p.price, p.currency, p.property_type,
    p.listing_type, p.is_furnished, p.status, p.bedrooms, p.bathrooms, p.area_sqm, p.floor,
    p.display_address, p.display_lat, p.display_lng,
    (SELECT url FROM property_photos ph WHERE ph.property_id = p.id AND ph.is_cover = true LIMIT 1),
    ps.public_contact_user_id, false
  FROM property_shares ps
  JOIN properties p ON p.id = ps.property_id
  WHERE ps.shared_with = p_agent_id
    AND ps.status = 'approved'
    AND ps.deleted_at IS NULL
    AND p.deleted_at IS NULL
    AND p.status != 'off_market';
$function$;
