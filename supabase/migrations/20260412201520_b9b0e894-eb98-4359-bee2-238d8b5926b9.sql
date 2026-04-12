
-- Add driver_balance column to profiles (amount driver owes platform)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS driver_balance numeric NOT NULL DEFAULT 0;
