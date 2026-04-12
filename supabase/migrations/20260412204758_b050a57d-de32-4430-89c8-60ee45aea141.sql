CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _partner_id uuid;
  _referral_code text;
BEGIN
  _referral_code := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'referral_code', '')), '');

  IF _referral_code IS NOT NULL THEN
    SELECT id
    INTO _partner_id
    FROM public.partner_companies
    WHERE referral_code = _referral_code
      AND status = 'approved'
    LIMIT 1;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, referred_by_partner_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    _partner_id
  );

  IF _partner_id IS NOT NULL THEN
    INSERT INTO public.partner_referrals (partner_id, referred_user_id, referral_code_used)
    VALUES (_partner_id, NEW.id, _referral_code)
    ON CONFLICT (referred_user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;