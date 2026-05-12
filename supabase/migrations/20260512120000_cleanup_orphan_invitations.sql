-- The earlier cleanup migration only removed invitations where
-- invited_by or accepted_by referenced a deleted user. Invitations
-- that the kept founder had sent OUT to the demo agents survived,
-- showing up in /agents long after the actual profiles were gone.
-- Wipe the orphans that point at emails no longer present in profiles.
DELETE FROM public.invitations
WHERE email IN ('agent1@re.com', 'agent2@re.com', 'newagent@example.com');
