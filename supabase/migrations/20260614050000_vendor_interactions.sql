-- Migration: Vendor Interactions & Study Group Time Alteration
-- 1. Alters study_groups.meet_time to TEXT to avoid timestamp parsing errors.
-- 2. Creates vendor_orders table with RLS.
-- 3. Creates deal_reviews table with RLS.
-- 4. Creates notification trigger for comment replies.

-- ─── 1. Alter study_groups.meet_time ──────────────────────────────────────────
ALTER TABLE public.study_groups ALTER COLUMN meet_time TYPE TEXT USING meet_time::text;

-- ─── 2. Create vendor_orders ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  deal_id     UUID REFERENCES public.vendor_deals(id) ON DELETE SET NULL,
  quantity    INT NOT NULL DEFAULT 1,
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vendor_orders ENABLE ROW LEVEL SECURITY;

-- Select/All policies
CREATE POLICY "Users can manage their own orders"
  ON public.vendor_orders
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Vendor owners can view and update orders"
  ON public.vendor_orders
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_orders.vendor_id AND v.owner_id = auth.uid()
    )
  );

-- ─── 3. Create deal_reviews ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deal_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     UUID NOT NULL REFERENCES public.vendor_deals(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating      INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(deal_id, user_id)
);

-- Enable RLS
ALTER TABLE public.deal_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view deal reviews"
  ON public.deal_reviews
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create reviews"
  ON public.deal_reviews
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY "Users can update/delete their own reviews"
  ON public.deal_reviews
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
  ON public.deal_reviews
  FOR DELETE
  USING (auth.uid() = user_id);

-- ─── 4. Trigger: Notify user when comment is replied to ──────────────────────
CREATE OR REPLACE FUNCTION public.notify_post_comment_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_author_id uuid;
  v_replier_name text;
  v_post_id uuid;
BEGIN
  -- Get the author of the parent comment
  SELECT author_id, post_id INTO v_parent_author_id, v_post_id
  FROM public.post_comments
  WHERE id = NEW.parent_id;

  -- Only notify if the replier is NOT the parent comment's author
  IF v_parent_author_id IS NOT NULL AND v_parent_author_id != NEW.author_id THEN
    -- Get replier's name
    SELECT full_name INTO v_replier_name
    FROM public.profiles
    WHERE id = NEW.author_id;

    INSERT INTO public.notifications (user_id, type, actor_id, entity_type, entity_id, body)
    VALUES (
      v_parent_author_id,
      'comment_reply',
      NEW.author_id,
      'post',
      v_post_id,
      COALESCE(v_replier_name, 'Someone') || ' replied to your comment'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_post_comment_reply ON public.post_comments;
CREATE TRIGGER trg_notify_post_comment_reply
  AFTER INSERT ON public.post_comments
  FOR EACH ROW
  WHEN (NEW.parent_id IS NOT NULL)
  EXECUTE FUNCTION public.notify_post_comment_reply();
