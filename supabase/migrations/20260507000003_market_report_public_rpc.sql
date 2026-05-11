-- ============================================================
-- get_public_market_report(token) — SECURITY DEFINER
--
-- The owner-facing report page is reached via a public token —
-- no authentication. We deliberately do NOT add a public RLS
-- policy on market_reports (too coarse). Instead, this function
-- runs with elevated privileges and returns ONLY the safe fields
-- needed by the public page:
--   • status must be 'completed'
--   • owner_visible must be true
--   • expires_at must be NULL or in the future
--
-- The function returns the AI report JSON and the property
-- summary, never the raw comparables or processing logs.
-- ============================================================

CREATE OR REPLACE FUNCTION get_public_market_report(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report      market_reports;
  v_property    properties;
  v_result      JSONB;
BEGIN
  -- Look up by public_token
  SELECT * INTO v_report
  FROM market_reports
  WHERE public_token = p_token
    AND status = 'completed'
    AND owner_visible = true
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Pull the linked property's safe fields
  SELECT * INTO v_property
  FROM properties
  WHERE id = v_report.property_id
    AND deleted_at IS NULL;

  -- Compose the safe payload. We expose:
  --   • report metadata (no internal IDs except the report id for analytics)
  --   • the AI report JSON (already owner-safe by design)
  --   • the deterministic pricing values
  --   • a property summary (NOT the exact address; only display_address)
  v_result := jsonb_build_object(
    'id',                    v_report.id,
    'created_at',            v_report.created_at,
    'report_type',           v_report.report_type,
    'report_locale',         v_report.report_locale,
    'currency',              v_report.currency,
    'recommended_price',     v_report.recommended_price,
    'recommended_price_min', v_report.recommended_price_min,
    'recommended_price_max', v_report.recommended_price_max,
    'confidence_score',      v_report.confidence_score,
    'report_json',           v_report.report_json,
    'pdf_path',              v_report.pdf_path,
    'property', CASE WHEN v_property.id IS NULL THEN NULL ELSE
      jsonb_build_object(
        'title',           v_property.title,
        'slug',            v_property.slug,
        'property_type',   v_property.property_type,
        'listing_type',    v_property.listing_type,
        'bedrooms',        v_property.bedrooms,
        'bathrooms',       v_property.bathrooms,
        'parking_spaces',  v_property.parking_spaces,
        'area_sqm',        v_property.area_sqm,
        'display_address', v_property.display_address,
        'currency',        v_property.currency,
        'price',           v_property.price
      )
    END
  );

  RETURN v_result;
END;
$$;

-- Allow anonymous + authenticated users to call it.
GRANT EXECUTE ON FUNCTION get_public_market_report(TEXT) TO anon, authenticated;
