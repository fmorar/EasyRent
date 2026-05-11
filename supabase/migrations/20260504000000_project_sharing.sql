-- ============================================================
-- PROJECT SHARING & FORK VISIBILITY
-- ============================================================
--
-- Rules:
--   1. Forks are private by default — only the creator sees them.
--   2. Creator may share their fork with agents in their 1-hop network
--      (the agent who invited them + the agents they invited directly).
--   3. Cannot share with anyone in the upstream fork chain (the creators
--      of any ancestor project) — prevents loops where a downstream user
--      shares back to an upstream creator.
--   4. Once I fork a project (master template OR shared fork), the source
--      disappears from MY list. If I delete my fork, the source reappears.
--   5. Anyone with read access to a project may fork it (not only master
--      templates).
-- ============================================================

-- ── Helper: 1-hop network membership ──────────────────────────
CREATE OR REPLACE FUNCTION is_in_my_network(other_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles me
    WHERE me.id = auth.uid()
      AND me.deleted_at IS NULL
      AND (
        -- other invited me (my upline)
        me.invited_by = other_id
        -- or I invited other (my downline)
        OR EXISTS (
          SELECT 1 FROM profiles other
          WHERE other.id = other_id
            AND other.invited_by = me.id
            AND other.deleted_at IS NULL
        )
      )
  );
$$;

-- ── Helper: is `candidate` an ancestor creator of project? ────
-- Walks the forked_from chain and returns true if `candidate` created
-- ANY ancestor project (excluding the project itself).
CREATE OR REPLACE FUNCTION is_ancestor_creator(p_project_id UUID, candidate UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH RECURSIVE chain AS (
    SELECT id, forked_from, created_by, 0 AS depth
      FROM projects WHERE id = p_project_id
    UNION ALL
    SELECT p.id, p.forked_from, p.created_by, c.depth + 1
      FROM projects p
      INNER JOIN chain c ON p.id = c.forked_from
      WHERE c.depth < 32  -- safety bound
  )
  SELECT EXISTS (
    SELECT 1 FROM chain
    WHERE created_by = candidate
      AND depth > 0  -- exclude the project itself
  );
$$;

-- ── project_shares: explicit grants ───────────────────────────
CREATE TABLE project_shares (
  project_id   UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  shared_with  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, shared_with)
);

CREATE INDEX idx_project_shares_shared_with ON project_shares(shared_with);

ALTER TABLE project_shares ENABLE ROW LEVEL SECURITY;

-- Read: project creator OR the recipient OR admin
CREATE POLICY "project_shares: read for owner or recipient"
  ON project_shares FOR SELECT
  USING (
    shared_with = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id
        AND created_by = auth.uid()
        AND deleted_at IS NULL
    )
    OR is_admin()
  );

-- Insert: only project creator, recipient must be in network and NOT in fork chain
CREATE POLICY "project_shares: insert by creator within network"
  ON project_shares FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id
        AND created_by = auth.uid()
        AND is_master_template = false
        AND deleted_at IS NULL
    )
    AND is_in_my_network(shared_with)
    AND NOT is_ancestor_creator(project_id, shared_with)
  );

-- Delete: only project creator
CREATE POLICY "project_shares: delete by creator"
  ON project_shares FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id
        AND created_by = auth.uid()
        AND deleted_at IS NULL
    )
  );

-- ── Replace projects read policy ──────────────────────────────
DROP POLICY IF EXISTS "projects: read all active" ON projects;

CREATE POLICY "projects: read visible"
  ON projects FOR SELECT
  USING (
    deleted_at IS NULL AND is_active = true AND (
      -- My own projects
      created_by = auth.uid()

      -- Admins see everything (active)
      OR is_admin()

      -- Otherwise visible if it is a master template OR a fork shared with me,
      -- AND I have not already forked it (forking hides the source).
      OR (
        (
          is_master_template = true
          OR EXISTS (
            SELECT 1 FROM project_shares
            WHERE project_shares.project_id = projects.id
              AND project_shares.shared_with = auth.uid()
          )
        )
        AND NOT EXISTS (
          SELECT 1 FROM projects fork
          WHERE fork.forked_from = projects.id
            AND fork.created_by = auth.uid()
            AND fork.deleted_at IS NULL
        )
      )
    )
  );
