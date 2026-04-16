-- Storage policies for community-verifications bucket
-- Path pattern: {user_id}/{community_id}/{filename}

CREATE POLICY "Users can upload their own community verification files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'community-verifications'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own community verification files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'community-verifications'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own community verification files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'community-verifications'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Admins can manage all community verification files"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'community-verifications'
  AND has_role(auth.uid(), 'admin'::app_role)
);