-- ============================================================
-- get_public_market_report v2 — cover photo + top comparables
--
-- Adds two new keys to the JSON the owner sees:
--   • property.cover_url   — the listing's cover photo (best photo,
--                            falls back to first by order_index)
--   • comparables[]        — top 10 comparables by similarity_score,
--                            outliers excluded, public-safe fields only
--
-- Privacy: comparables are public listings on third-party portals,
-- so exposing title + price + listing_url is fine. We deliberately
-- do NOT expose raw_text, agent_or_company, or extracted_data.
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
  v_cover_url   TEXT;
  v_comparables JSONB;
  v_result      JSONB;
BEGIN
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

  SELECT * INTO v_property
  FROM properties
  WHERE id = v_report.property_id
    AND deleted_at IS NULL;

  -- Cover photo: prefer the one marked is_cover, else the lowest
  -- order_index. Photos are stored on the property-photos bucket
  -- and exposed via .url.
  SELECT pp.url INTO v_cover_url
  FROM property_photos pp
  WHERE pp.property_id = v_report.property_id
  ORDER BY pp.is_cover DESC, pp.order_index ASC
  LIMIT 1;

  -- Top comparables — by similarity, kept (no exclusion_reason),
  -- non-outlier. Capped at 10.
  SELECT COALESCE(jsonb_agg(c ORDER BY similarity_score DESC NULLS LAST), '[]'::jsonb)
    INTO v_comparables
  FROM (
    SELECT
      title,
      source_name,
      listing_url,
      location_text,
      canton,
      district,
      price,
      currency,
      bedrooms,
      bathrooms,
      built_area_m2,
      price_per_m2,
      similarity_score
    FROM market_report_comparables
    WHERE report_id = v_report.id
      AND is_outlier = false
      AND exclusion_reason IS NULL
    ORDER BY similarity_score DESC NULLS LAST, price_per_m2 ASC NULLS LAST
    LIMIT 10
  ) c;

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
    'comparables',           v_comparables,
    'property', CASE WHEN v_property.id IS NULL THEN NULL ELSE
      jsonb_build_object(
        'title',           v_property.title,
        'slug',            v_property.slug,
        'cover_url',       v_cover_url,
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

GRANT EXECUTE ON FUNCTION get_public_market_report(TEXT) TO anon, authenticated;
