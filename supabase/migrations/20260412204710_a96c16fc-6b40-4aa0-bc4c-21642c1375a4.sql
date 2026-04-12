CREATE OR REPLACE FUNCTION public.generate_unique_partner_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _code text;
BEGIN
  LOOP
    _code := LPAD(FLOOR(RANDOM() * 1000000)::text, 6, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.partner_companies
      WHERE referral_code = _code
    );
  END LOOP;

  RETURN _code;
END;
$$;

WITH ranked_codes AS (
  SELECT
    id,
    referral_code,
    ROW_NUMBER() OVER (PARTITION BY referral_code ORDER BY created_at, id) AS dup_rank
  FROM public.partner_companies
)
UPDATE public.partner_companies AS pc
SET referral_code = public.generate_unique_partner_referral_code()
FROM ranked_codes rc
WHERE pc.id = rc.id
  AND (
    rc.referral_code IS NULL
    OR rc.referral_code !~ '^[0-9]{6}$'
    OR rc.dup_rank > 1
  );

ALTER TABLE public.partner_companies
DROP CONSTRAINT IF EXISTS partner_companies_referral_code_format;

ALTER TABLE public.partner_companies
ADD CONSTRAINT partner_companies_referral_code_format
CHECK (referral_code ~ '^[0-9]{6}$');

CREATE UNIQUE INDEX IF NOT EXISTS partner_companies_referral_code_unique
ON public.partner_companies (referral_code);

CREATE OR REPLACE FUNCTION public.assign_partner_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL
     OR NEW.referral_code !~ '^[0-9]{6}$'
     OR EXISTS (
       SELECT 1
       FROM public.partner_companies
       WHERE referral_code = NEW.referral_code
         AND (TG_OP = 'INSERT' OR id <> NEW.id)
     ) THEN
    NEW.referral_code := public.generate_unique_partner_referral_code();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_partner_referral_code_on_write ON public.partner_companies;

CREATE TRIGGER assign_partner_referral_code_on_write
BEFORE INSERT OR UPDATE OF referral_code ON public.partner_companies
FOR EACH ROW
EXECUTE FUNCTION public.assign_partner_referral_code();

WITH ranked_referrals AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY referred_user_id ORDER BY created_at, id) AS rn
  FROM public.partner_referrals
)
DELETE FROM public.partner_referrals pr
USING ranked_referrals rr
WHERE pr.id = rr.id
  AND rr.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS partner_referrals_referred_user_unique
ON public.partner_referrals (referred_user_id);