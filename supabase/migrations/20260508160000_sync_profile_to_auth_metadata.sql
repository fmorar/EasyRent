-- Keep `auth.users.raw_user_meta_data` in sync with `public.profiles`.
--
-- Why: the JWT issued by Supabase carries `raw_user_meta_data`, so any
-- client code reading `user.user_metadata.full_name` (or slug/role)
-- will see whatever was set when the row in `auth.users` was last
-- written. If we update the profile through the app and don't push
-- the change up to auth.users, the JWT lags behind and the user sees
-- their old name in the UI until they re-authenticate.
--
-- This trigger fires after a profile UPDATE that changes any of the
-- three fields the JWT cares about (full_name, slug, role) and
-- mirrors them into auth.users.raw_user_meta_data.
--
-- We don't sync `email` here — Supabase Auth owns the email column
-- and changing it has its own confirmation flow.

CREATE OR REPLACE FUNCTION public.sync_profile_to_auth_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
-- Fix the search_path to a known-safe value so the function can't be
-- hijacked by an attacker who creates a same-named object in another
-- schema. (Required for SECURITY DEFINER functions.)
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Merge the three product-canonical fields into the existing JSONB.
  -- `||` does a shallow merge; pre-existing keys (`email_verified`,
  -- custom claims, etc.) survive intact.
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'full_name', NEW.full_name,
      'slug',      NEW.slug,
      'role',      NEW.role::text
    )
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Restrict execution to roles that can already write the table (the
-- trigger fires from server-side context, not from the client).
REVOKE ALL ON FUNCTION public.sync_profile_to_auth_metadata() FROM PUBLIC;

DROP TRIGGER IF EXISTS profiles_sync_auth_metadata ON public.profiles;

CREATE TRIGGER profiles_sync_auth_metadata
  AFTER UPDATE OF full_name, slug, role ON public.profiles
  FOR EACH ROW
  WHEN (
       OLD.full_name IS DISTINCT FROM NEW.full_name
    OR OLD.slug      IS DISTINCT FROM NEW.slug
    OR OLD.role      IS DISTINCT FROM NEW.role
  )
  EXECUTE FUNCTION public.sync_profile_to_auth_metadata();

COMMENT ON FUNCTION public.sync_profile_to_auth_metadata() IS
  'Mirrors profile changes (full_name, slug, role) into auth.users.raw_user_meta_data so the JWT stays in sync. Fires from the profiles_sync_auth_metadata trigger.';
