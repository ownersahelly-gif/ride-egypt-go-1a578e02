
-- Add arrival_time to stops
ALTER TABLE public.stops ADD COLUMN arrival_time time without time zone DEFAULT NULL;

-- Insert global waiting time setting (default 3 minutes)
INSERT INTO public.app_settings (key, value)
VALUES ('stop_waiting_time_minutes', '3')
ON CONFLICT (key) DO NOTHING;
