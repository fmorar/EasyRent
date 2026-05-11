-- ============================================================
-- invitation_zones — pre-assign coverage zones at invite time
-- ============================================================
--
-- When an admin (or another agent) invites a new user, they pick the
-- zones the new agent will cover. Those codes get stored on the
-- invitation row and copied to the new profile when the invitee
-- accepts.

ALTER TABLE invitations
  ADD COLUMN zones TEXT[] NOT NULL DEFAULT '{}';

-- Update the auth-user trigger so it reads zones from the JWT metadata
-- that `acceptInvitation` puts there.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_full_name TEXT;
  v_role      user_role;
  v_slug      TEXT;
  v_email     TEXT;
  v_zones     TEXT[];
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_role      := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'agent');
  v_email     := COALESCE(NEW.email, NEW.raw_user_meta_data->>'email');
  v_slug      := COALESCE(
    NEW.raw_user_meta_data->>'slug',
    lower(regexp_replace(v_full_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substring(NEW.id::text, 1, 6)
  );
  -- Pull zones from metadata; default to empty array if absent
  v_zones := COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'zones')),
    ARRAY[]::TEXT[]
  );

  INSERT INTO profiles (id, full_name, slug, email, role, zones)
  VALUES (NEW.id, v_full_name, v_slug, v_email, v_role, v_zones)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
