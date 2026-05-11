-- ============================================================
-- get_public_property_performance_report(token) — SECURITY DEFINER
--
-- Single source of truth for what the property owner sees on the
-- public link. Privacy-by-default: lead names are stripped to
-- "Maria G." style initials, no phone/email/notes ever leave the DB.
--
-- Visibility settings on the report row gate which sections render
-- (defense in depth — even if the public page accidentally tries
-- to render `leads`, it gets an empty array when the agent toggled
-- show_lead_list off).
-- ============================================================

CREATE OR REPLACE FUNCTION get_public_property_performance_report(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report     property_performance_reports;
  v_property   properties;
  v_creator    profiles;
  v_cover_url  TEXT;
  v_visibility JSONB;
  v_show_leads BOOLEAN;
  v_initials   BOOLEAN;
  v_leads      JSONB;
  v_result     JSONB;
BEGIN
  SELECT * INTO v_report
  FROM property_performance_reports
  WHERE public_token = p_token
    AND status = 'active'
    AND owner_visible = true
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_visibility := v_report.visibility_settings;
  v_show_leads := COALESCE((v_visibility->>'show_lead_list')::boolean,    true);
  v_initials   := COALESCE((v_visibility->>'lead_initials_only')::boolean, true);

  SELECT * INTO v_property
  FROM properties
  WHERE id = v_report.property_id AND deleted_at IS NULL;

  SELECT * INTO v_creator
  FROM profiles
  WHERE id = v_report.created_by AND deleted_at IS NULL;

  SELECT pp.url INTO v_cover_url
  FROM property_photos pp
  WHERE pp.property_id = v_report.property_id
  ORDER BY pp.is_cover DESC, pp.order_index ASC
  LIMIT 1;

  -- Privacy-safe lead summary. We pull at most 25 leads for the property,
  -- in the report period, and project ONLY the safe columns. Lead name
  -- is reduced to "First L." (first word + initial) when initials_only
  -- is on (default).
  IF v_show_leads THEN
    SELECT COALESCE(jsonb_agg(c ORDER BY c.created_at DESC), '[]'::jsonb)
    INTO v_leads
    FROM (
      SELECT
        CASE
          WHEN v_initials THEN
            -- "Maria González" → "Maria G."
            split_part(l.full_name, ' ', 1) ||
            CASE
              WHEN strpos(l.full_name, ' ') > 0
                THEN ' ' || left(split_part(l.full_name, ' ', 2), 1) || '.'
              ELSE ''
            END
          ELSE l.full_name
        END                                AS lead_label,
        l.stage,
        l.interest_level,
        l.source,
        l.public_summary,
        l.appointment_at,
        l.appointment_status,
        l.created_at
      FROM leads l
      WHERE l.property_id = v_report.property_id
        AND l.deleted_at IS NULL
        AND l.is_archived = false
        AND (
          v_report.report_period_start IS NULL
          OR l.created_at >= v_report.report_period_start
        )
        AND (
          v_report.report_period_end IS NULL
          OR l.created_at <= v_report.report_period_end
        )
      ORDER BY l.created_at DESC
      LIMIT 25
    ) c;
  ELSE
    v_leads := '[]'::jsonb;
  END IF;

  v_result := jsonb_build_object(
    'id',                  v_report.id,
    'created_at',          v_report.created_at,
    'last_generated_at',   v_report.last_generated_at,
    'period_start',        v_report.report_period_start,
    'period_end',          v_report.report_period_end,
    'performance_score',   v_report.performance_score,
    'performance_status',  v_report.performance_status,
    'summary',             v_report.summary,
    'report_json',         v_report.report_json,
    'pdf_path',            v_report.pdf_path,
    'visibility',          v_visibility,
    'leads',               v_leads,
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
        'price',           v_property.price,
        'created_at',      v_property.created_at
      )
    END
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_property_performance_report(TEXT) TO anon, authenticated;
