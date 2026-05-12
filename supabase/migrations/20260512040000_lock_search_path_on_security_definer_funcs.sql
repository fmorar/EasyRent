-- Defense-in-depth: every SECURITY DEFINER function in public should
-- pin its search_path so it can't be tricked into resolving the wrong
-- schema (security) and doesn't silently fail when invoked from a
-- context with a stripped search_path (correctness — same class of bug
-- as the is_admin() one that hid /agents members).
ALTER FUNCTION public.get_agent_profile_properties      SET search_path = public, pg_temp;
ALTER FUNCTION public.get_my_role                       SET search_path = public, pg_temp;
ALTER FUNCTION public.is_ancestor_creator               SET search_path = public, pg_temp;
ALTER FUNCTION public.is_in_my_network                  SET search_path = public, pg_temp;
ALTER FUNCTION public.record_lead_stage_change          SET search_path = public, pg_temp;
ALTER FUNCTION public.refresh_marketplace_visibility    SET search_path = public, pg_temp;
ALTER FUNCTION public.user_has_forked                   SET search_path = public, pg_temp;
ALTER FUNCTION public.user_has_share                    SET search_path = public, pg_temp;
ALTER FUNCTION public.user_owns_non_template            SET search_path = public, pg_temp;
ALTER FUNCTION public.user_owns_project                 SET search_path = public, pg_temp;
