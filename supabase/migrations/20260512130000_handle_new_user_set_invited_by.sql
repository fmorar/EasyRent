-- handle_new_user was discarding the invited_by metadata passed by
-- acceptInvitation, so newly accepted users showed up with NULL in
-- profiles.invited_by — breaking the /agents members list that uses
-- "invited_by = me" to render the team. Patch the function to also
-- pull invited_by from the metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_full_name  TEXT;
  v_role       public.user_role;
  v_slug       TEXT;
  v_email      TEXT;
  v_zones      TEXT[];
  v_invited_by UUID;
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
  v_invited_by := NULLIF(NEW.raw_user_meta_data->>'invited_by', '')::uuid;

  INSERT INTO public.profiles (id, full_name, slug, email, role, zones, invited_by)
  VALUES (NEW.id, v_full_name, v_slug, v_email, v_role, v_zones, v_invited_by)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Backfill the 2 existing profiles whose invited_by got dropped on the
-- way in. Match each profile to its invitation row by email.
UPDATE public.profiles p
SET invited_by = i.invited_by
FROM public.invitations i
WHERE p.invited_by IS NULL
  AND lower(p.email) = lower(i.email)
  AND i.status = 'accepted';
