
UPDATE storage.buckets SET public = true WHERE id = 'instapay-proofs';

CREATE POLICY "Public can view instapay proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'instapay-proofs');
