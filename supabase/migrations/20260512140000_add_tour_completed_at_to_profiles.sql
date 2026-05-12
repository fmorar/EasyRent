-- Onboarding tour completion stamp. NULL = user hasn't finished (or
-- skipped) the agent first-property tour yet, so the dashboard will
-- auto-launch it on next mount. Set once and never cleared.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS tour_completed_at TIMESTAMPTZ;

-- Treat the existing accounts as "already onboarded" — they don't
-- need to see a first-time tour now that the platform is in use.
-- Super admins never see the tour anyway, so leave them untouched
-- (they'll trip the gate via role check on the client).
UPDATE public.profiles
SET tour_completed_at = COALESCE(tour_completed_at, now())
WHERE deleted_at IS NULL;
