-- Public read of active agent profiles
--
-- The original "profiles: read own or admin reads all" policy keeps
-- everything private to the row owner + admins. That's the right
-- default — but it also breaks the public surfaces that need to show
-- an agent's contact info to logged-out visitors:
--
--   • /agents/[slug]                 — the agent's public profile
--   • /p/[slug]                      — the property detail page's
--                                      "publicado por" + sidebar with
--                                      phone / email / WhatsApp
--   • Public market reports          — the agent signature block
--
-- This policy is ADDITIVE (RLS policies are OR'd). It only opens up
-- rows that are already meant to be public — non-deleted, active
-- agents and admins. Visitors still can't read draft / soft-deleted
-- profiles or the rest of the team. The columns surfaced by the
-- product (full_name, slug, avatar_url, cover_url, bio, phone, email,
-- zones) match what's already published on /agents/[slug]; this
-- doesn't expose any new data.

DROP POLICY IF EXISTS "profiles: anon read active agents"
  ON public.profiles;

CREATE POLICY "profiles: anon read active agents"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (
    status     = 'active'
    AND deleted_at IS NULL
    AND role IN ('agent', 'owner_admin')
  );

COMMENT ON POLICY "profiles: anon read active agents"
  ON public.profiles IS
  'Allows logged-out and logged-in visitors to see contact info for active agents and admins. Required for /agents/[slug] and the property detail contact sidebar.';
