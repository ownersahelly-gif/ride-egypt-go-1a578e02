
ALTER TABLE public.driver_schedules
ADD COLUMN min_passengers integer NOT NULL DEFAULT 5,
ADD COLUMN return_time time without time zone;
