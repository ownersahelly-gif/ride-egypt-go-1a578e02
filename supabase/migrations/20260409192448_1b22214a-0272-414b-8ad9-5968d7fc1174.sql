ALTER TABLE public.bookings
  ADD COLUMN custom_pickup_lat DOUBLE PRECISION,
  ADD COLUMN custom_pickup_lng DOUBLE PRECISION,
  ADD COLUMN custom_pickup_name TEXT;