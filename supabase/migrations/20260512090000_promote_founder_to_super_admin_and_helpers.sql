-- Promote the platform founder to super_admin and update the role
-- helpers so the operational gates keep working.
--
-- After this migration:
--   role = 'super_admin'   → can do everything an admin can + the
--                            future super-only features (creating
--                            owner_admin invitations, audit
--                            surfaces, etc.). Data scoping stays
--                            the same as everyone — own + shared.
--   role = 'owner_admin'   → existing admin powers, but cannot
--                            create other admins via the invite flow.
--   role = 'agent'         → can invite peer agents only.

-- 1) Promote founder
UPDATE public.profiles
SET role = 'super_admin'::public.user_role
WHERE email = 'fabianmorar1223@gmail.com'
  AND deleted_at IS NULL;

-- 2) is_admin() now returns true for owner_admin OR super_admin so
--    the existing admin UI gates (revoke invitation, /shares review
--    queue, profiles read-all) work for both tiers.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('owner_admin'::public.user_role, 'super_admin'::public.user_role)
      AND deleted_at IS NULL
  );
$function$;

-- 3) is_super_admin() — only super_admin. For future features that
--    are platform-owner exclusive (data audit surfaces, billing, etc.)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'::public.user_role
      AND deleted_at IS NULL
  );
$function$;

-- Keep is_owner_admin() pointing strictly at owner_admin since the
-- semantics there meant "the operational admin, not the super tier"
-- in places that used it.
CREATE OR REPLACE FUNCTION public.is_owner_admin()
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
