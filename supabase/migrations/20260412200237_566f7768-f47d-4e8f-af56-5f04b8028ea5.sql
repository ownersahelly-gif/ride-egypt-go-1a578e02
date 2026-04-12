
-- Partner companies table
CREATE TABLE public.partner_companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  referral_code TEXT NOT NULL UNIQUE,
  commission_percentage NUMERIC NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'pending',
  bank_details TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can view their own company" ON public.partner_companies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Partners can update their own company" ON public.partner_companies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can create partner company" ON public.partner_companies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all partner companies" ON public.partner_companies FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_partner_companies_updated_at BEFORE UPDATE ON public.partner_companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Partner referrals table
CREATE TABLE public.partner_referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.partner_companies(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL,
  referral_code_used TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can view their own referrals" ON public.partner_referrals FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.partner_companies WHERE id = partner_referrals.partner_id AND user_id = auth.uid())
);
CREATE POLICY "System can create referrals" ON public.partner_referrals FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage all referrals" ON public.partner_referrals FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Partner earnings table
CREATE TABLE public.partner_earnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.partner_companies(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can view their own earnings" ON public.partner_earnings FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.partner_companies WHERE id = partner_earnings.partner_id AND user_id = auth.uid())
);
CREATE POLICY "Admins can manage all earnings" ON public.partner_earnings FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_partner_earnings_updated_at BEFORE UPDATE ON public.partner_earnings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Platform earnings table
CREATE TABLE public.platform_earnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id),
  user_id UUID NOT NULL,
  driver_id UUID,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  driver_payment_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage platform earnings" ON public.platform_earnings FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_platform_earnings_updated_at BEFORE UPDATE ON public.platform_earnings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Partner route requests table
CREATE TABLE public.partner_route_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.partner_companies(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  origin_name TEXT NOT NULL,
  origin_lat DOUBLE PRECISION NOT NULL,
  origin_lng DOUBLE PRECISION NOT NULL,
  destination_name TEXT NOT NULL,
  destination_lat DOUBLE PRECISION NOT NULL,
  destination_lng DOUBLE PRECISION NOT NULL,
  stops_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  price NUMERIC NOT NULL DEFAULT 0,
  estimated_duration_minutes INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_route_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can view their own route requests" ON public.partner_route_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.partner_companies WHERE id = partner_route_requests.partner_id AND user_id = auth.uid())
);
CREATE POLICY "Partners can create route requests" ON public.partner_route_requests FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.partner_companies WHERE id = partner_route_requests.partner_id AND user_id = auth.uid())
);
CREATE POLICY "Admins can manage all route requests" ON public.partner_route_requests FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_partner_route_requests_updated_at BEFORE UPDATE ON public.partner_route_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by_partner_id UUID REFERENCES public.partner_companies(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMP WITH TIME ZONE;

-- Add columns to bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS platform_fee NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS partner_fee NUMERIC NOT NULL DEFAULT 0;
