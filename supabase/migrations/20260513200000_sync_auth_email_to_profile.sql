-- Mirror auth.users.email changes back to public.profiles.email.
--
-- Supabase Auth owns the email column on auth.users — when a user
-- requests an email change via supabase.auth.updateUser({ email })
-- and confirms it via the link, the value updates there. But our
-- `profiles` table carries its own `email` column that the app reads
-- across the dashboard / public pages / contact resolution. Without
-- this trigger that column lags behind forever.
--
-- We only fire after `email_confirmed_at` actually moves (the user
-- has clicked the confirmation link), so an in-flight unconfirmed
-- request doesn't sneak the new email into the profile.

CREATE OR REPLACE FUNCTION public.sync_auth_email_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email
     AND NEW.email IS NOT NULL THEN
    UPDATE public.profiles
    SET email = NEW.email
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_auth_email_to_profile() FROM PUBLIC;

DROP TRIGGER IF EXISTS auth_users_email_sync ON auth.users;

CREATE TRIGGER auth_users_email_sync
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_auth_email_to_profile();
