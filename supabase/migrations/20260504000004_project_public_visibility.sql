-- Public visibility for project pages.
-- The creator can opt-in to expose the project's marketing page to the world.

ALTER TABLE projects
  ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_projects_public ON projects(is_public) WHERE is_public = true;

CREATE POLICY "projects: public read"
  ON projects FOR SELECT
  TO anon, authenticated
  USING (
    is_public = true
    AND is_active = true
    AND deleted_at IS NULL
  );
