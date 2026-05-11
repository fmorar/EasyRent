
CREATE TABLE IF NOT EXISTS property_videos (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  youtube_url text        NOT NULL,
  title       text,
  order_index integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_videos_property_id ON property_videos (property_id);

ALTER TABLE property_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users manage property videos"
  ON property_videos FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "public read property videos"
  ON property_videos FOR SELECT
  USING (true);
