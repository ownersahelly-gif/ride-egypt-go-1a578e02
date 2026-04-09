
-- Add boarding verification columns to bookings
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS boarding_code TEXT,
ADD COLUMN IF NOT EXISTS boarded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS dropped_off_at TIMESTAMPTZ;

-- Create unique index on boarding_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_boarding_code ON public.bookings (boarding_code) WHERE boarding_code IS NOT NULL;

-- Function to generate a random 6-digit boarding code
CREATE OR REPLACE FUNCTION public.generate_boarding_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  code TEXT;
  exists_already BOOLEAN;
BEGIN
  LOOP
    code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    SELECT EXISTS(SELECT 1 FROM public.bookings WHERE boarding_code = code) INTO exists_already;
    IF NOT exists_already THEN
      NEW.boarding_code := code;
      EXIT;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- Trigger to auto-generate boarding code on insert
CREATE TRIGGER set_boarding_code
BEFORE INSERT ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.generate_boarding_code();

-- Create ride_messages table for in-app chat
CREATE TABLE public.ride_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ride_messages_booking ON public.ride_messages (booking_id, created_at);

-- Enable RLS
ALTER TABLE public.ride_messages ENABLE ROW LEVEL SECURITY;

-- Passengers can view messages for their own bookings
CREATE POLICY "Users can view messages for their bookings"
ON public.ride_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.bookings 
    WHERE bookings.id = ride_messages.booking_id 
    AND bookings.user_id = auth.uid()
  )
);

-- Drivers can view messages for bookings on their shuttle
CREATE POLICY "Drivers can view messages for their shuttle bookings"
ON public.ride_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.shuttles s ON s.id = b.shuttle_id
    WHERE b.id = ride_messages.booking_id
    AND s.driver_id = auth.uid()
  )
);

-- Users can send messages for their own bookings
CREATE POLICY "Users can send messages for their bookings"
ON public.ride_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.bookings 
    WHERE bookings.id = ride_messages.booking_id 
    AND bookings.user_id = auth.uid()
  )
);

-- Drivers can send messages for bookings on their shuttle
CREATE POLICY "Drivers can send messages for their shuttle bookings"
ON public.ride_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.shuttles s ON s.id = b.shuttle_id
    WHERE b.id = ride_messages.booking_id
    AND s.driver_id = auth.uid()
  )
);

-- Admins can manage all messages
CREATE POLICY "Admins can manage all messages"
ON public.ride_messages
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime on ride_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_messages;
