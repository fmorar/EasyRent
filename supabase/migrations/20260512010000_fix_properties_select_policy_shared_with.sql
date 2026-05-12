-- Fix: the SELECT policy on properties had a typo in the property_shares
-- correlation subquery — "ps.property_id = ps.id" compared the share's own
-- columns instead of correlating to the outer properties.id. That made the
-- "shared with me" branch dead code: it never matched.
DROP POLICY IF EXISTS "properties: owner or admin reads all" ON public.properties;

CREATE POLICY "properties: owner or admin reads all"
ON public.properties
FOR SELECT
USING (
  public.is_admin()
  OR (created_by = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.property_shares ps
    WHERE ps.property_id = properties.id
      AND ps.shared_with = auth.uid()
      AND ps.status = 'approved'::share_status
      AND ps.deleted_at IS NULL
  )
);
