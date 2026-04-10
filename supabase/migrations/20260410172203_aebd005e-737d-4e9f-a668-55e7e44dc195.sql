CREATE POLICY "Authenticated users can update ride seats"
ON public.ride_instances
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);