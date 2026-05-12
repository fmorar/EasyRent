-- Forks created before the application-level inheritance fix
-- (forkProject now copies photos + amenities) ended up with empty
-- gallery + amenity lists. Backfill them from forked_from so the
-- existing forks land on the same UX as new ones.
INSERT INTO public.project_photos (project_id, url, storage_path, type, is_cover, order_index, caption)
SELECT p.id, sp.url, sp.storage_path, sp.type, sp.is_cover, sp.order_index, sp.caption
FROM public.projects p
JOIN public.project_photos sp ON sp.project_id = p.forked_from
WHERE p.forked_from IS NOT NULL
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.project_photos pp WHERE pp.project_id = p.id
  );

INSERT INTO public.project_amenities (project_id, name, icon, sort_order)
SELECT p.id, sa.name, sa.icon, sa.sort_order
FROM public.projects p
JOIN public.project_amenities sa ON sa.project_id = p.forked_from
WHERE p.forked_from IS NOT NULL
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.project_amenities pa WHERE pa.project_id = p.id
  );
