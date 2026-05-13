-- Allow anon reads of property_translations for properties that
-- expose an anonymous link.
--
-- The existing "public read translations for public properties" policy
-- only covers marketplace-visible listings. The unbranded link is
-- specifically for sharing properties OFF the marketplace, so it falls
-- through and the EN/locale overlays never reach the unbranded page —
-- the description stays in Spanish even when the toggle flips locale.
--
-- This is the translations-side mirror of how v_properties_anonymous
-- exposes the property row itself.

CREATE POLICY "property_translations: anonymous link read"
  ON property_translations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_translations.property_id
        AND p.anonymous_slug IS NOT NULL
        AND p.deleted_at IS NULL
    )
  );
