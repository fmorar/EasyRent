-- ===================================================================
-- One-shot cleanup: prune demo + test data so the platform starts
-- with a minimal, real working state.
--
-- Keep:
--   profiles: rmoyasan@gmail.com, fabianmorar@hotmail.com,
--             fabianmorar1223@gmail.com (super_admin)
--   projects: Secrt Escalante template (id …0001)
--   properties: 74d6cd74-f8c5-4872-a75c-37f4e87235bc
--
-- Everything else (contracts, shares, leads, reports, draft props,
-- demo agents and their inventory) is removed.
-- ===================================================================

-- ── Pass 1: data tied to deleted users or non-kept properties/projects
WITH target_users AS (
  SELECT id FROM public.profiles
  WHERE email IN (
    'fabianmorar1223+test@gmail.com',
    'agent1@re.com',
    'agent2@re.com'
  )
),
delete_props AS (
  SELECT id FROM public.properties
  WHERE id <> '74d6cd74-f8c5-4872-a75c-37f4e87235bc'::uuid
),
delete_projects AS (
  SELECT id FROM public.projects
  WHERE id <> '10000000-0000-0000-0000-000000000001'::uuid
),
d_analytics AS (
  DELETE FROM public.property_analytics_events
  WHERE property_id IN (SELECT id FROM delete_props) RETURNING 1
),
d_leads_1 AS (
  DELETE FROM public.leads
  WHERE property_id IN (SELECT id FROM delete_props)
     OR assigned_to IN (SELECT id FROM target_users) RETURNING 1
),
d_perf_events AS (
  DELETE FROM public.property_performance_report_events
  WHERE report_id IN (
    SELECT id FROM public.property_performance_reports
    WHERE property_id IN (SELECT id FROM delete_props)
       OR created_by  IN (SELECT id FROM target_users)
  ) RETURNING 1
),
d_perf AS (
  DELETE FROM public.property_performance_reports
  WHERE property_id IN (SELECT id FROM delete_props)
     OR created_by  IN (SELECT id FROM target_users) RETURNING 1
),
d_mkt_comp AS (
  DELETE FROM public.market_report_comparables
  WHERE report_id IN (
    SELECT id FROM public.market_reports
    WHERE property_id IN (SELECT id FROM delete_props)
       OR created_by  IN (SELECT id FROM target_users)
  ) RETURNING 1
),
d_mkt_events AS (
  DELETE FROM public.market_report_events
  WHERE report_id IN (
    SELECT id FROM public.market_reports
    WHERE property_id IN (SELECT id FROM delete_props)
       OR created_by  IN (SELECT id FROM target_users)
  ) RETURNING 1
),
d_mkt_sources AS (
  DELETE FROM public.market_report_sources
  WHERE report_id IN (
    SELECT id FROM public.market_reports
    WHERE property_id IN (SELECT id FROM delete_props)
       OR created_by  IN (SELECT id FROM target_users)
  ) RETURNING 1
),
d_mkt_views AS (
  DELETE FROM public.market_report_public_views
  WHERE report_id IN (
    SELECT id FROM public.market_reports
    WHERE property_id IN (SELECT id FROM delete_props)
       OR created_by  IN (SELECT id FROM target_users)
  ) RETURNING 1
),
d_mkt AS (
  DELETE FROM public.market_reports
  WHERE property_id IN (SELECT id FROM delete_props)
     OR created_by  IN (SELECT id FROM target_users) RETURNING 1
),
d_contract_events AS (
  DELETE FROM public.contract_events
  WHERE contract_id IN (
    SELECT id FROM public.contracts
    WHERE property_id IN (SELECT id FROM delete_props)
       OR created_by  IN (SELECT id FROM target_users)
  ) RETURNING 1
),
d_contract_exports AS (
  DELETE FROM public.contract_exports
  WHERE contract_id IN (
    SELECT id FROM public.contracts
    WHERE property_id IN (SELECT id FROM delete_props)
       OR created_by  IN (SELECT id FROM target_users)
  ) RETURNING 1
),
d_contract_versions AS (
  DELETE FROM public.contract_versions
  WHERE contract_id IN (
    SELECT id FROM public.contracts
    WHERE property_id IN (SELECT id FROM delete_props)
       OR created_by  IN (SELECT id FROM target_users)
  ) RETURNING 1
),
d_contracts AS (
  DELETE FROM public.contracts
  WHERE property_id IN (SELECT id FROM delete_props)
     OR created_by  IN (SELECT id FROM target_users) RETURNING 1
),
d_pshares AS (
  DELETE FROM public.property_shares
  WHERE property_id IN (SELECT id FROM delete_props)
     OR shared_by   IN (SELECT id FROM target_users)
     OR shared_with IN (SELECT id FROM target_users) RETURNING 1
),
d_jshares AS (
  DELETE FROM public.project_shares
  WHERE project_id  IN (SELECT id FROM delete_projects)
     OR shared_with IN (SELECT id FROM target_users) RETURNING 1
),
d_pphotos AS (
  DELETE FROM public.property_photos
  WHERE property_id IN (SELECT id FROM delete_props) RETURNING 1
),
d_pvideos AS (
  DELETE FROM public.property_videos
  WHERE property_id IN (SELECT id FROM delete_props) RETURNING 1
),
d_ptrans AS (
  DELETE FROM public.property_translations
  WHERE property_id IN (SELECT id FROM delete_props) RETURNING 1
),
d_powners AS (
  DELETE FROM public.property_owners
  WHERE property_id IN (SELECT id FROM delete_props) RETURNING 1
),
d_jphotos AS (
  DELETE FROM public.project_photos
  WHERE project_id IN (SELECT id FROM delete_projects) RETURNING 1
),
d_jamenities AS (
  DELETE FROM public.project_amenities
  WHERE project_id IN (SELECT id FROM delete_projects) RETURNING 1
),
d_jfaqs AS (
  DELETE FROM public.project_faqs
  WHERE project_id IN (SELECT id FROM delete_projects) RETURNING 1
),
d_blog AS (
  DELETE FROM public.blog_posts
  WHERE author_id IN (SELECT id FROM target_users) RETURNING 1
),
d_inv AS (
  DELETE FROM public.invitations
  WHERE invited_by  IN (SELECT id FROM target_users)
     OR accepted_by IN (SELECT id FROM target_users) RETURNING 1
),
d_props AS (
  DELETE FROM public.properties
  WHERE id IN (SELECT id FROM delete_props) RETURNING 1
),
d_projects AS (
  DELETE FROM public.projects
  WHERE id IN (SELECT id FROM delete_projects) RETURNING 1
),
d_profiles AS (
  DELETE FROM public.profiles
  WHERE id IN (SELECT id FROM target_users) RETURNING id
)
SELECT count(*) AS profiles_removed FROM d_profiles;

-- ── Pass 2: stale state hanging off the kept property
-- (contracts, leads, reports the deleted demo agents accumulated
--  against fabianmorar1223@gmail.com's property are noise we want
--  gone too — the spec calls for 0 of these in the final state.)
WITH
  d_perf_events_2 AS (
    DELETE FROM property_performance_report_events
    WHERE report_id IN (SELECT id FROM property_performance_reports) RETURNING 1
  ),
  d_perf_2 AS (DELETE FROM property_performance_reports RETURNING 1),
  d_mkt_comp_2 AS (DELETE FROM market_report_comparables RETURNING 1),
  d_mkt_events_2 AS (DELETE FROM market_report_events RETURNING 1),
  d_mkt_sources_2 AS (DELETE FROM market_report_sources RETURNING 1),
  d_mkt_views_2 AS (DELETE FROM market_report_public_views RETURNING 1),
  d_mkt_2 AS (DELETE FROM market_reports RETURNING 1),
  d_cev_2 AS (DELETE FROM contract_events RETURNING 1),
  d_cex_2 AS (DELETE FROM contract_exports RETURNING 1),
  d_cvr_2 AS (DELETE FROM contract_versions RETURNING 1),
  d_contracts_2 AS (DELETE FROM contracts RETURNING 1),
  d_leads_2 AS (DELETE FROM leads RETURNING 1)
SELECT 1;

-- ── Pass 3: auth.users so the emails are reusable and any session
--    chain is severed.
DELETE FROM auth.users
WHERE email IN (
  'fabianmorar1223+test@gmail.com',
  'agent1@re.com',
  'agent2@re.com'
);
