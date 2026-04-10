-- Add preferred_days column to route_requests
ALTER TABLE public.route_requests
ADD COLUMN preferred_days integer[] DEFAULT '{}';

-- Update price per km to 2
UPDATE public.app_settings SET value = '2', updated_at = now() WHERE key = 'price_per_km';