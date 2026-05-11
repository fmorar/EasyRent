-- Admins should respect fork privacy on read.
-- The previous "projects: admin insert/update/delete" policy was FOR ALL,
-- which also granted SELECT bypass to admins. Split it into three write-only
-- policies and strip is_admin() from the read policy so admins see only:
--   - projects they created
--   - master templates they haven't forked
--   - forks explicitly shared with them
--
-- Admins keep full INSERT / UPDATE / DELETE privileges.

DROP POLICY IF EXISTS "projects: admin insert/update/delete" ON projects;

CREATE POLICY "projects: admin insert"
  ON projects FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "projects: admin update"
  ON projects FOR UPDATE
  USING (is_admin());

CREATE POLICY "projects: admin delete"
  ON projects FOR DELETE
  USING (is_admin());

DROP POLICY IF EXISTS "projects: read visible" ON projects;

CREATE POLICY "projects: read visible"
  ON projects FOR SELECT
  USING (
    deleted_at IS NULL AND is_active = true AND (
      created_by = auth.uid()
      OR (
        (is_master_template = true OR user_has_share(projects.id))
        AND NOT user_has_forked(projects.id)
      )
    )
  );
