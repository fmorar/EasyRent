-- Property-level amenities. Free-form text array so the UI can offer a
-- predefined picker plus custom entries without a join table.

ALTER TABLE properties
  ADD COLUMN amenities TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX idx_properties_amenities ON properties USING GIN (amenities);
