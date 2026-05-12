-- Contracts SELECT was a tangle of three overlapping policies:
--   • "contracts: admin full access"        — is_admin()          (ALL cmd)
--   • "contracts: agent reads own created"  — created_by = me
--   • "contracts_select"                    — created_by = me OR is_owner_admin()
--
-- Two problems with that:
--   1) Admin auto-bypass meant any owner_admin invitee saw every
--      contract on the platform (same shape as the /properties leak
--      we fixed earlier).
--   2) There was no way for the property owner who SHARED a listing
--      to see contracts a sharee agent created on it — the only path
--      back to the owner was the "shared_by" relationship on
--      property_shares, which no policy referenced.
--
-- The new single SELECT policy expresses both rules: you see your own
-- contracts, plus contracts on properties you shared (status=approved).
-- The admin ALL policy is dropped; UPDATE/DELETE keep their own
-- is_owner_admin() escape hatch so operations can still intervene.
DROP POLICY IF EXISTS "contracts: admin full access"       ON public.contracts;
DROP POLICY IF EXISTS "contracts: agent reads own created" ON public.contracts;
DROP POLICY IF EXISTS "contracts_select"                   ON public.contracts;

CREATE POLICY "contracts: own or property shared by me"
ON public.contracts
FOR SELECT
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.property_shares ps
    WHERE ps.property_id = contracts.property_id
      AND ps.shared_by   = auth.uid()
      AND ps.status      = 'approved'::share_status
      AND ps.deleted_at  IS NULL
  )
);
