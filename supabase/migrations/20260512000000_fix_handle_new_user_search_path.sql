-- Fix: handle_new_user() failed with "type user_role does not exist"
-- because Supabase auth invokes the trigger as supabase_auth_admin,
-- whose default search_path does not include public. Two fixes layered
-- so this stays robust regardless of who calls it:
--   1) SET search_path explicitly on the function
--   2) Schema-qualify every public-schema identifier used inside
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_full_name TEXT;
  v_role      public.user_role;
  v_slug      TEXT;
  v_email     TEXT;
  v_zones     TEXT[];
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_role      := COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'agent'::public.user_role);
  v_email     := COALESCE(NEW.email, NEW.raw_user_meta_data->>'email');
  v_slug      := COALESCE(
    NEW.raw_user_meta_data->>'slug',
    lower(regexp_replace(v_full_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substring(NEW.id::text, 1, 6)
  );
  v_zones := COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'zones')),
    ARRAY[]::TEXT[]
  );

  INSERT INTO public.profiles (id, full_name, slug, email, role, zones)
  VALUES (NEW.id, v_full_name, v_slug, v_email, v_role, v_zones)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;
