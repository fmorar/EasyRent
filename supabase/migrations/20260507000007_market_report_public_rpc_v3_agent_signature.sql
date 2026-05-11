-- ============================================================
-- get_public_market_report v3 — adds agent signature block
--
-- Surfaces the creator's safe profile fields (name, slug, avatar,
-- phone, email) so the public report can render a "Preparado por"
-- block with the agent's contact info. The owner gets a person to
-- follow up with, not just a faceless number.
--
-- Privacy: we only return data that's already exposed on the
-- agent's public profile page (`/agente/<slug>`).
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
  v_creator     profiles;
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

  SELECT * INTO v_creator
  FROM profiles
  WHERE id = v_report.created_by
    AND deleted_at IS NULL;

  SELECT pp.url INTO v_cover_url
  FROM property_photos pp
  WHERE pp.property_id = v_report.property_id
  ORDER BY pp.is_cover DESC, pp.order_index ASC
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(c ORDER BY similarity_score DESC NULLS LAST), '[]'::jsonb)
    INTO v_comparables
  FROM (
    SELECT
      title, source_name, listing_url, location_text, canton, district,
      price, currency, bedrooms, bathrooms, built_area_m2, price_per_m2,
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
    'agent', CASE WHEN v_creator.id IS NULL THEN NULL ELSE
      jsonb_build_object(
        'full_name',  v_creator.full_name,
        'slug',       v_creator.slug,
        'avatar_url', v_creator.avatar_url,
        'phone',      v_creator.phone,
        'email',      v_creator.email,
        'bio',        v_creator.bio
      )
    END,
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
