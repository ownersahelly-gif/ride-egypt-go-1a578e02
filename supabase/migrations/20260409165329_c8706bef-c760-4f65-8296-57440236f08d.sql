
-- Create user type enum
CREATE TYPE public.user_type AS ENUM ('customer', 'driver', 'admin');

-- Create app role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  user_type public.user_type NOT NULL DEFAULT 'customer',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Routes table
CREATE TABLE public.routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description_en TEXT,
  description_ar TEXT,
  origin_name_en TEXT NOT NULL,
  origin_name_ar TEXT NOT NULL,
  origin_lat DOUBLE PRECISION NOT NULL,
  origin_lng DOUBLE PRECISION NOT NULL,
  destination_name_en TEXT NOT NULL,
  destination_name_ar TEXT NOT NULL,
  destination_lat DOUBLE PRECISION NOT NULL,
  destination_lng DOUBLE PRECISION NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  estimated_duration_minutes INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active routes" ON public.routes FOR SELECT USING (status = 'active' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage routes" ON public.routes FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Stops table
CREATE TABLE public.stops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  stop_order INTEGER NOT NULL DEFAULT 0,
  stop_type TEXT NOT NULL DEFAULT 'both',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view stops" ON public.stops FOR SELECT USING (true);
CREATE POLICY "Admins can manage stops" ON public.stops FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Shuttles table
CREATE TABLE public.shuttles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  vehicle_plate TEXT NOT NULL,
  vehicle_model TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 14,
  status TEXT NOT NULL DEFAULT 'inactive',
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shuttles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active shuttles" ON public.shuttles FOR SELECT USING (status = 'active' OR driver_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Drivers can update their shuttle" ON public.shuttles FOR UPDATE USING (driver_id = auth.uid());
CREATE POLICY "Admins can manage shuttles" ON public.shuttles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Shuttle schedules
CREATE TABLE public.shuttle_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shuttle_id UUID REFERENCES public.shuttles(id) ON DELETE CASCADE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  departure_time TIME NOT NULL,
  arrival_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shuttle_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view schedules" ON public.shuttle_schedules FOR SELECT USING (true);
CREATE POLICY "Admins can manage schedules" ON public.shuttle_schedules FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Bookings table
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  shuttle_id UUID REFERENCES public.shuttles(id) ON DELETE SET NULL,
  route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  pickup_stop_id UUID REFERENCES public.stops(id) ON DELETE SET NULL,
  dropoff_stop_id UUID REFERENCES public.stops(id) ON DELETE SET NULL,
  seats INTEGER NOT NULL DEFAULT 1,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own bookings" ON public.bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own bookings" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own bookings" ON public.bookings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Drivers can view bookings for their shuttles" ON public.bookings FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.shuttles WHERE shuttles.id = bookings.shuttle_id AND shuttles.driver_id = auth.uid())
);
CREATE POLICY "Admins can manage bookings" ON public.bookings FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Route requests
CREATE TABLE public.route_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  origin_name TEXT NOT NULL,
  origin_lat DOUBLE PRECISION NOT NULL,
  origin_lng DOUBLE PRECISION NOT NULL,
  destination_name TEXT NOT NULL,
  destination_lat DOUBLE PRECISION NOT NULL,
  destination_lng DOUBLE PRECISION NOT NULL,
  preferred_time TIME,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.route_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own requests" ON public.route_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create requests" ON public.route_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage requests" ON public.route_requests FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Driver applications
CREATE TABLE public.driver_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  license_number TEXT NOT NULL,
  vehicle_model TEXT NOT NULL,
  vehicle_plate TEXT NOT NULL,
  vehicle_year INTEGER NOT NULL,
  experience_years INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own applications" ON public.driver_applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create applications" ON public.driver_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage applications" ON public.driver_applications FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Ratings
CREATE TABLE public.ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view ratings" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "Users can create ratings for their bookings" ON public.ratings FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON public.routes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_shuttles_updated_at BEFORE UPDATE ON public.shuttles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_driver_applications_updated_at BEFORE UPDATE ON public.driver_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
