-- Performance reports SELECT was "created_by = me OR is owner_admin".
-- Two problems:
--   1) Any owner_admin invitee saw every report on the platform.
--   2) An agent who received a property via property_shares (the share
--      RECIPIENT) had no way to see the performance reports running on
--      that property — even though that's exactly the inventory they
--      were given to market.
--
-- New SELECT policy expresses the rule "yours or on a property shared
-- with you (approved)". UPDATE/DELETE keep their existing owner-or-admin
-- escape hatch so operations can still intervene.
DROP POLICY IF EXISTS "perf_reports_select_own_or_admin" ON public.property_performance_reports;

CREATE POLICY "perf_reports: own or property shared with me"
ON public.property_performance_reports
FOR SELECT
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.property_shares ps
    WHERE ps.property_id = property_performance_reports.property_id
      AND ps.shared_with = auth.uid()
      AND ps.status      = 'approved'::share_status
      AND ps.deleted_at  IS NULL
  )
);
