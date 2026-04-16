ALTER TABLE public.carpool_routes 
ADD COLUMN IF NOT EXISTS day_time_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.carpool_routes.day_time_overrides IS 'Per-day time overrides: { "0": {"departure":"08:00","return":"17:00"}, "1": {...} } where keys are day_of_week (0=Sun..6=Sat). Empty {} means use the default departure_time / return_time for all selected days.';