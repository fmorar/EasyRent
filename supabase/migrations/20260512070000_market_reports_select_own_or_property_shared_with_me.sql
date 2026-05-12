-- Mirror the perf_reports scoping: market_reports SELECT was
-- "created_by = me OR is owner_admin". Two issues, same as before:
--   1) Any owner_admin invitee saw every market report on the platform.
--   2) Recipients of property_shares had no way to see analyses on
--      properties they were given to market.
-- New rule: yours, or on a property approved-shared TO you.
-- UPDATE/DELETE keep their existing admin escape hatch; the page-level
-- regenerate/duplicate/delete actions enforce creator-only at the
-- application layer.
DROP POLICY IF EXISTS "market_reports_select_own_or_admin" ON public.market_reports;

CREATE POLICY "market_reports: own or property shared with me"
ON public.market_reports
FOR SELECT
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.property_shares ps
    WHERE ps.property_id = market_reports.property_id
      AND ps.shared_with = auth.uid()
      AND ps.status      = 'approved'::share_status
      AND ps.deleted_at  IS NULL
  )
);
