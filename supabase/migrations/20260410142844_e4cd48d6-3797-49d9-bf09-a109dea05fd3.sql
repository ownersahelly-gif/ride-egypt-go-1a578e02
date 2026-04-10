-- Add trip_direction column to bookings
ALTER TABLE public.bookings 
ADD COLUMN trip_direction text NOT NULL DEFAULT 'both';

-- Add a comment for clarity
COMMENT ON COLUMN public.bookings.trip_direction IS 'go = going only, return = return only, both = round trip';