-- Private bucket for worker incident photo evidence (user-scoped paths).
-- Paths: {auth.uid()}/incident_{timestamp}.{ext}

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'incident-evidence',
  'incident-evidence',
  false,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "Users upload own incident evidence" ON storage.objects;
CREATE POLICY "Users upload own incident evidence"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'incident-evidence'
    AND (
      (storage.foldername(name))[1] = auth.uid()::TEXT
      OR name LIKE (auth.uid()::TEXT || '/%')
    )
  );

DROP POLICY IF EXISTS "Users read own incident evidence" ON storage.objects;
CREATE POLICY "Users read own incident evidence"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'incident-evidence'
    AND (
      (storage.foldername(name))[1] = auth.uid()::TEXT
      OR name LIKE (auth.uid()::TEXT || '/%')
      OR is_current_admin()
    )
  );

DROP POLICY IF EXISTS "Admins full manage incident evidence" ON storage.objects;
CREATE POLICY "Admins full manage incident evidence"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'incident-evidence'
    AND is_current_admin()
  );
