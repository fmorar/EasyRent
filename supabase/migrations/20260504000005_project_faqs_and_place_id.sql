-- FAQs editable per project (collapsible on the public page)
CREATE TABLE project_faqs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  question    TEXT        NOT NULL CHECK (char_length(question) <= 300),
  answer      TEXT        NOT NULL,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_faqs_project ON project_faqs(project_id, sort_order);

ALTER TABLE project_faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_faqs: read all"
  ON project_faqs FOR SELECT USING (true);

CREATE POLICY "project_faqs: write via project ownership"
  ON project_faqs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id
        AND (created_by = auth.uid() OR is_admin())
        AND deleted_at IS NULL
    )
  );

ALTER TABLE projects
  ADD COLUMN google_place_id TEXT;
