-- One-time backfill: invitations were left at status='pending' because
-- acceptInvitation() never updated the row after creating the auth user
-- (the application-level bug is fixed separately). Any pending row whose
-- email already maps to a profile is, by definition, accepted.
UPDATE public.invitations i
SET
  status      = 'accepted',
  accepted_at = COALESCE(i.accepted_at, p.created_at),
  accepted_by = COALESCE(i.accepted_by, p.id)
FROM public.profiles p
WHERE i.status = 'pending'
  AND lower(p.email) = lower(i.email)
  AND p.deleted_at IS NULL;
