-- Admin-controlled ad banners shown in the app feed carousel.

CREATE TABLE IF NOT EXISTS public.app_ads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  subtitle      TEXT NOT NULL,
  color         TEXT NOT NULL DEFAULT '#7c3aed',
  icon          TEXT NOT NULL DEFAULT 'megaphone-outline',
  active        BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_ads ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read active ads
CREATE POLICY "ads_select" ON public.app_ads
  FOR SELECT TO authenticated USING (active = true);

-- Service role (dashboard) can do everything
CREATE POLICY "ads_service_all" ON public.app_ads
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed three default ads so the carousel is not empty
INSERT INTO public.app_ads (title, subtitle, color, icon, display_order) VALUES
  ('50% Off Campus Coffee',       'Show your FAF app at the Student Center cafe to get half off any latte before 10 AM.', '#7c3aed', 'cafe',              0),
  ('Spring Tech Hackathon',       'Join the CS club this weekend. Free pizza, prizes, and great networking! Register now.', '#0891b2', 'laptop-outline',   1),
  ('Exclusive Vendor Deals',      'Check out the Discover tab to find amazing local discounts just for students.',          '#b45309', 'pricetag',          2);
