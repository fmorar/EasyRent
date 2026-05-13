-- Backfill anonymous_slug for every property that doesn't have one.
--
-- The unbranded link is no longer a toggle the agent flips on — it's
-- always available, generated at property creation. createProperty
-- and createDraftProperty already set it for new rows; this migration
-- catches existing rows.
--
-- Slug format: 12 chars from a 64-char URL-safe alphabet (matches the
-- nanoid(12) format the JS layer produces, so links generated before
-- and after look the same). Generated row-by-row so we don't collide
-- on identical timestamps.

CREATE OR REPLACE FUNCTION gen_anonymous_slug() RETURNS text AS $$
DECLARE
  alphabet text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  out text := '';
  i int;
BEGIN
  FOR i IN 1..12 LOOP
    out := out || substr(alphabet, 1 + floor(random() * 64)::int, 1);
  END LOOP;
  RETURN out;
END;
$$ LANGUAGE plpgsql VOLATILE
SET search_path = public, pg_temp;

UPDATE properties
SET anonymous_slug = gen_anonymous_slug()
WHERE anonymous_slug IS NULL
  AND deleted_at IS NULL;

-- Helper isn't needed at runtime (JS does the generation for new rows).
-- Drop it so we don't keep an unused function around.
DROP FUNCTION gen_anonymous_slug();
