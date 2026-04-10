
-- Carpool verifications table
CREATE TABLE public.carpool_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  id_front_url TEXT,
  id_back_url TEXT,
  driving_license_url TEXT,
  car_license_url TEXT,
  selfie_url TEXT,
  license_plate TEXT,
  vehicle_model TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.carpool_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own verification" ON public.carpool_verifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own verification" ON public.carpool_verifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own verification" ON public.carpool_verifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all verifications" ON public.carpool_verifications FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_carpool_verifications_updated_at BEFORE UPDATE ON public.carpool_verifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Carpool routes table
CREATE TABLE public.carpool_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  origin_name TEXT NOT NULL,
  origin_lat DOUBLE PRECISION NOT NULL,
  origin_lng DOUBLE PRECISION NOT NULL,
  destination_name TEXT NOT NULL,
  destination_lat DOUBLE PRECISION NOT NULL,
  destination_lng DOUBLE PRECISION NOT NULL,
  departure_time TIME WITHOUT TIME ZONE NOT NULL,
  is_daily BOOLEAN NOT NULL DEFAULT false,
  days_of_week INTEGER[] DEFAULT '{}',
  share_fuel BOOLEAN NOT NULL DEFAULT false,
  fuel_share_amount NUMERIC DEFAULT 0,
  allow_car_swap BOOLEAN NOT NULL DEFAULT false,
  available_seats INTEGER NOT NULL DEFAULT 3,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.carpool_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active carpool routes" ON public.carpool_routes FOR SELECT USING (status = 'active' OR auth.uid() = user_id);
CREATE POLICY "Verified users can create routes" ON public.carpool_routes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own routes" ON public.carpool_routes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own routes" ON public.carpool_routes FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all carpool routes" ON public.carpool_routes FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_carpool_routes_updated_at BEFORE UPDATE ON public.carpool_routes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Carpool requests table
CREATE TABLE public.carpool_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.carpool_routes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  pickup_name TEXT NOT NULL,
  pickup_lat DOUBLE PRECISION NOT NULL,
  pickup_lng DOUBLE PRECISION NOT NULL,
  dropoff_name TEXT NOT NULL,
  dropoff_lat DOUBLE PRECISION NOT NULL,
  dropoff_lng DOUBLE PRECISION NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.carpool_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own requests" ON public.carpool_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Route owners can view requests for their routes" ON public.carpool_requests FOR SELECT USING (EXISTS (SELECT 1 FROM public.carpool_routes WHERE id = carpool_requests.route_id AND user_id = auth.uid()));
CREATE POLICY "Verified users can create requests" ON public.carpool_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own requests" ON public.carpool_requests FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Route owners can update requests" ON public.carpool_requests FOR UPDATE USING (EXISTS (SELECT 1 FROM public.carpool_routes WHERE id = carpool_requests.route_id AND user_id = auth.uid()));
CREATE POLICY "Admins can manage all requests" ON public.carpool_requests FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_carpool_requests_updated_at BEFORE UPDATE ON public.carpool_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Carpool messages table
CREATE TABLE public.carpool_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.carpool_routes(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.carpool_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Route participants can view messages" ON public.carpool_messages FOR SELECT USING (
  auth.uid() IN (
    SELECT user_id FROM public.carpool_routes WHERE id = carpool_messages.route_id
    UNION
    SELECT user_id FROM public.carpool_requests WHERE route_id = carpool_messages.route_id AND status = 'accepted'
  )
);
CREATE POLICY "Route participants can send messages" ON public.carpool_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND auth.uid() IN (
    SELECT user_id FROM public.carpool_routes WHERE id = carpool_messages.route_id
    UNION
    SELECT user_id FROM public.carpool_requests WHERE route_id = carpool_messages.route_id AND status = 'accepted'
  )
);
CREATE POLICY "Admins can manage all carpool messages" ON public.carpool_messages FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket for carpool verification documents
INSERT INTO storage.buckets (id, name, public) VALUES ('carpool-documents', 'carpool-documents', false);

CREATE POLICY "Users can upload their own carpool docs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'carpool-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view their own carpool docs" ON storage.objects FOR SELECT USING (bucket_id = 'carpool-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Admins can view all carpool docs" ON storage.objects FOR SELECT USING (bucket_id = 'carpool-documents' AND has_role(auth.uid(), 'admin'::app_role));
