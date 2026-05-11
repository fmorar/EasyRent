-- ============================================================
-- maintenance_fee — monthly HOA / building fee
--
-- Only meaningful for SALE listings. For rentals the maintenance
-- fee is conventionally already included in the monthly rent
-- (Costa Rica market practice), so the UI hides this field when
-- listing_type = 'rent'. The column is nullable across the board.
-- ============================================================

ALTER TABLE properties
  ADD COLUMN maintenance_fee NUMERIC(12,2);

COMMENT ON COLUMN properties.maintenance_fee IS
  'Monthly HOA / condominium fee in the same currency as price. '
  'Only set for sale listings — rentals include it in the price.';
