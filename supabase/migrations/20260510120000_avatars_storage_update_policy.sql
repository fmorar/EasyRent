-- Add the missing UPDATE policy on `storage.objects` for the
-- `avatars` bucket. Without it, `upsert: true` on the existing
-- avatar path fails — the same foot-gun we hit on `rental-contracts`.
--
-- The existing policies cover SELECT (public read), INSERT (any
-- authenticated user uploading into their own folder) and DELETE
-- (owner only). UPDATE was named in the policy comment but never
-- registered as a separate `cmd`.
--
-- Path convention: first folder = the user's auth.uid(). The
-- restriction below mirrors the DELETE policy so users can only
-- overwrite their own avatar files.

CREATE POLICY "avatars: own update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );
