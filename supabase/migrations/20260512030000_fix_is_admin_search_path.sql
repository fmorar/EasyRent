-- is_admin() is a SECURITY DEFINER helper invoked from RLS policies on
-- properties, profiles, leads, etc. Without an explicit search_path it
-- inherits the caller's, which can omit "public" in some Supabase
-- contexts — leading to silent "relation profiles does not exist"
-- errors that make the policy evaluate to false. Lock it down.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'owner_admin'::public.user_role
      AND deleted_at IS NULL
  );
$function$;
