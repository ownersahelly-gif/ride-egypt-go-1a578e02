
-- Add payment proof and waitlist columns to bookings
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS payment_proof_url text,
ADD COLUMN IF NOT EXISTS waitlist_position integer;

-- Create storage bucket for InstaPay payment proofs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('instapay-proofs', 'instapay-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Users can upload their own payment proofs
CREATE POLICY "Users can upload payment proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'instapay-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can view their own payment proofs
CREATE POLICY "Users can view own payment proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'instapay-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admins can view all payment proofs
CREATE POLICY "Admins can view all payment proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'instapay-proofs' AND public.has_role(auth.uid(), 'admin'));
