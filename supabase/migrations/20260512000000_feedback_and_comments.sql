-- feedbacks table
CREATE TABLE IF NOT EXISTS public.feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  upvotes INT DEFAULT 0,
  downvotes INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feedback read" ON public.feedbacks;
CREATE POLICY "feedback read" ON public.feedbacks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "feedback insert" ON public.feedbacks;
CREATE POLICY "feedback insert" ON public.feedbacks FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "feedback update own" ON public.feedbacks;
CREATE POLICY "feedback update own" ON public.feedbacks FOR UPDATE TO authenticated USING (auth.uid() = author_id);

-- feedback_votes table
CREATE TABLE IF NOT EXISTS public.feedback_votes (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  feedback_id UUID REFERENCES feedbacks(id) ON DELETE CASCADE,
  vote INT NOT NULL CHECK (vote IN (1, -1)),
  PRIMARY KEY (user_id, feedback_id)
);
ALTER TABLE public.feedback_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fvote read" ON public.feedback_votes;
CREATE POLICY "fvote read" ON public.feedback_votes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "fvote all" ON public.feedback_votes;
CREATE POLICY "fvote all" ON public.feedback_votes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- feedback_comments table
CREATE TABLE IF NOT EXISTS public.feedback_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES feedbacks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.feedback_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fcomment read" ON public.feedback_comments;
CREATE POLICY "fcomment read" ON public.feedback_comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "fcomment insert" ON public.feedback_comments;
CREATE POLICY "fcomment insert" ON public.feedback_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

-- Keep comments_count in sync
CREATE OR REPLACE FUNCTION public.sync_feedback_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feedbacks SET comments_count = comments_count + 1 WHERE id = NEW.feedback_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feedbacks SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.feedback_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_feedback_comments_count ON public.feedback_comments;
CREATE TRIGGER trg_feedback_comments_count
  AFTER INSERT OR DELETE ON public.feedback_comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_feedback_comments_count();
