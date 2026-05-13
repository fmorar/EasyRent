-- Expose `amenities` through v_properties_anonymous
--
-- The anonymous (unbranded) listing page was missing the Amenidades
-- section because the view didn't surface the property's amenities
-- array. Amenities are non-identifying (piscina, gimnasio, BBQ, etc.)
-- — safe to expose on the no-branding link.

CREATE OR REPLACE VIEW v_properties_anonymous AS
SELECT id,
       title,
       description,
       price,
       currency,
       property_type,
       listing_type,
       is_furnished,
       status,
       bedrooms,
       bathrooms,
       area_sqm,
       floor,
       total_floors,
       parking_spaces,
       location_mode,
       display_address,
       display_lat,
       display_lng,
       project_id,
       anonymous_slug,
       created_at,
       -- new columns must be appended at the end — CREATE OR REPLACE
       -- VIEW disallows reordering existing columns.
       amenities
  FROM properties p
 WHERE anonymous_slug IS NOT NULL AND deleted_at IS NULL;
