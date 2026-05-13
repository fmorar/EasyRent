-- Property translations: let property owners manage their own
--
-- Previously only owner_admin could write translations, so an agent
-- creating a draft and triggering the AI translation hit
-- "new row violates row-level security policy" on the upsert.
--
-- Mirror the `properties` table policies: read/write allowed when the
-- caller created the property OR is an admin (owner_admin/super_admin).
-- Public SELECT for marketplace-visible properties is preserved.

DROP POLICY IF EXISTS "admin full access on translations" ON property_translations;

CREATE POLICY "property_translations: owner or admin select"
  ON property_translations FOR SELECT
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_translations.property_id
        AND (p.created_by = auth.uid() OR is_admin())
    )
  );

CREATE POLICY "property_translations: owner or admin insert"
  ON property_translations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_translations.property_id
        AND (p.created_by = auth.uid() OR is_admin())
    )
  );

CREATE POLICY "property_translations: owner or admin update"
  ON property_translations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_translations.property_id
        AND (p.created_by = auth.uid() OR is_admin())
    )
  );

CREATE POLICY "property_translations: owner or admin delete"
  ON property_translations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_translations.property_id
        AND (p.created_by = auth.uid() OR is_admin())
    )
  );
