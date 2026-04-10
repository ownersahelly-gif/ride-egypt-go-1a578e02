-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can update ride seats" ON public.ride_instances;

-- Create a scoped policy: authenticated users can update ride_instances
-- This is needed so customers can decrement available_seats when booking
CREATE POLICY "Authenticated users can decrement seats"
ON public.ride_instances
FOR UPDATE
TO authenticated
USING (available_seats > 0)
WITH CHECK (available_seats >= 0);