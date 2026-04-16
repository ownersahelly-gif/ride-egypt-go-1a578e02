-- ============ COMMUNITIES ============
CREATE TABLE public.communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL,
  name_ar text NOT NULL,
  description_en text,
  description_ar text,
  logo_url text,
  allowed_modes text[] NOT NULL DEFAULT ARRAY['car_sharing','fuel_share','paid'],
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active communities" ON public.communities
  FOR SELECT USING (status = 'active' OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage communities" ON public.communities
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_communities_updated BEFORE UPDATE ON public.communities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ VERIFICATION QUESTIONS ============
CREATE TABLE public.community_verification_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  label_en text NOT NULL,
  label_ar text NOT NULL,
  field_type text NOT NULL DEFAULT 'text', -- text|number|dropdown|file
  options jsonb DEFAULT '[]'::jsonb, -- for dropdown: [{value,label_en,label_ar}]
  required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.community_verification_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view questions" ON public.community_verification_questions
  FOR SELECT USING (true);
CREATE POLICY "Admins manage questions" ON public.community_verification_questions
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ============ MEMBERSHIPS ============
CREATE TABLE public.community_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending', -- pending|approved|rejected
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, community_id)
);
ALTER TABLE public.community_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own memberships" ON public.community_memberships
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own memberships" ON public.community_memberships
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own pending memberships" ON public.community_memberships
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Admins manage memberships" ON public.community_memberships
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_memberships_updated BEFORE UPDATE ON public.community_memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ VERIFICATION ANSWERS ============
CREATE TABLE public.community_verification_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES public.community_memberships(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.community_verification_questions(id) ON DELETE CASCADE,
  answer_text text,
  answer_file_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.community_verification_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own answers" ON public.community_verification_answers
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.community_memberships m
    WHERE m.id = membership_id AND m.user_id = auth.uid()
  ));
CREATE POLICY "Users create own answers" ON public.community_verification_answers
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.community_memberships m
    WHERE m.id = membership_id AND m.user_id = auth.uid()
  ));
CREATE POLICY "Admins manage answers" ON public.community_verification_answers
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ============ CARPOOL ROUTES: add community + mode ============
ALTER TABLE public.carpool_routes
  ADD COLUMN community_id uuid REFERENCES public.communities(id) ON DELETE SET NULL,
  ADD COLUMN mode text NOT NULL DEFAULT 'car_sharing',
  ADD COLUMN return_time time,
  ADD COLUMN has_return boolean NOT NULL DEFAULT false;

-- ============ HELPER: check if two users share an approved community ============
CREATE OR REPLACE FUNCTION public.users_share_community(_user_a uuid, _user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.community_memberships a
    JOIN public.community_memberships b
      ON a.community_id = b.community_id
    WHERE a.user_id = _user_a AND a.status = 'approved'
      AND b.user_id = _user_b AND b.status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.user_in_community(_user uuid, _community uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_memberships
    WHERE user_id = _user AND community_id = _community AND status = 'approved'
  );
$$;

-- ============ TIGHTEN CARPOOL ROUTES VISIBILITY (strict same-community) ============
DROP POLICY IF EXISTS "Anyone can view active carpool routes" ON public.carpool_routes;

CREATE POLICY "Members view community routes" ON public.carpool_routes
  FOR SELECT USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'admin')
    OR (
      status = 'active'
      AND community_id IS NOT NULL
      AND public.user_in_community(auth.uid(), community_id)
    )
  );

-- ============ STORAGE BUCKET FOR COMMUNITY VERIFICATION FILES ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-verifications', 'community-verifications', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own community verification files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'community-verifications'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users read own community verification files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'community-verifications'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'))
  );