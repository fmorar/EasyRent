-- Add a `cover_url` column to `profiles` so each agent can pick a
-- dedicated banner image for their public profile (`/agents/[slug]`).
-- Falls back to the avatar (blurred) when null — see the page render
-- for the fallback chain.
--
-- Storage: lives in the same `avatars` bucket as the profile photo,
-- under path `${userId}/cover.{ext}`. The bucket's RLS policies
-- already scope INSERT/UPDATE/DELETE to the owner's folder, so no
-- new policy is needed.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cover_url text;

COMMENT ON COLUMN public.profiles.cover_url IS
  'Public URL of the agent''s banner photo. Stored in the `avatars` bucket under `${userId}/cover.{ext}`. Null falls back to a blurred avatar on the public profile.';
