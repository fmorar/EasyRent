-- Fix RLS recursion between projects ↔ project_shares.
-- The previous policies queried each other's tables directly inside RLS
-- expressions, which re-entered the calling policy and exploded at runtime.
-- We wrap the cross-table EXISTS checks in SECURITY DEFINER functions so
-- those subqueries bypass RLS.

CREATE OR REPLACE FUNCTION user_owns_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id
      AND created_by = auth.uid()
      AND deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION user_has_forked(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE forked_from = p_project_id
      AND created_by = auth.uid()
      AND deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION user_has_share(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_shares
    WHERE project_id = p_project_id
      AND shared_with = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION user_owns_non_template(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id
      AND created_by = auth.uid()
      AND is_master_template = false
      AND deleted_at IS NULL
  );
$$;

DROP POLICY IF EXISTS "projects: read visible" ON projects;
CREATE POLICY "projects: read visible"
  ON projects FOR SELECT
  USING (
    deleted_at IS NULL AND is_active = true AND (
      created_by = auth.uid()
      OR is_admin()
      OR (
        (is_master_template = true OR user_has_share(projects.id))
        AND NOT user_has_forked(projects.id)
      )
    )
  );

DROP POLICY IF EXISTS "project_shares: read for owner or recipient" ON project_shares;
CREATE POLICY "project_shares: read for owner or recipient"
  ON project_shares FOR SELECT
  USING (
    shared_with = auth.uid()
    OR user_owns_project(project_id)
    OR is_admin()
  );

DROP POLICY IF EXISTS "project_shares: insert by creator within network" ON project_shares;
CREATE POLICY "project_shares: insert by creator within network"
  ON project_shares FOR INSERT
  WITH CHECK (
    user_owns_non_template(project_id)
    AND is_in_my_network(shared_with)
    AND NOT is_ancestor_creator(project_id, shared_with)
  );

DROP POLICY IF EXISTS "project_shares: delete by creator" ON project_shares;
CREATE POLICY "project_shares: delete by creator"
  ON project_shares FOR DELETE
  USING (user_owns_project(project_id));
