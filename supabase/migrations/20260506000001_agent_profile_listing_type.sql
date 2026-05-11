-- Add listing_type to get_agent_profile_properties so the agent profile
-- page can render the "En venta" / "En alquiler" badge correctly.

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
    p.listing_type, p.status, p.bedrooms, p.bathrooms, p.area_sqm, p.floor,
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
    p.listing_type, p.status, p.bedrooms, p.bathrooms, p.area_sqm, p.floor,
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
