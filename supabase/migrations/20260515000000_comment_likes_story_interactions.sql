-- ===== 1. Vote count sync trigger (fixes counts disappearing on reload) =====

CREATE OR REPLACE FUNCTION public.sync_feedback_vote_counts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.feedbacks SET
      upvotes   = (SELECT COUNT(*) FROM public.feedback_votes WHERE feedback_id = OLD.feedback_id AND vote = 1),
      downvotes = (SELECT COUNT(*) FROM public.feedback_votes WHERE feedback_id = OLD.feedback_id AND vote = -1)
    WHERE id = OLD.feedback_id;
  ELSE
    UPDATE public.feedbacks SET
      upvotes   = (SELECT COUNT(*) FROM public.feedback_votes WHERE feedback_id = NEW.feedback_id AND vote = 1),
      downvotes = (SELECT COUNT(*) FROM public.feedback_votes WHERE feedback_id = NEW.feedback_id AND vote = -1)
    WHERE id = NEW.feedback_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_feedback_vote_counts ON public.feedback_votes;
CREATE TRIGGER trg_sync_feedback_vote_counts
AFTER INSERT OR UPDATE OR DELETE ON public.feedback_votes
FOR EACH ROW EXECUTE FUNCTION public.sync_feedback_vote_counts();

-- Backfill existing rows so current data is correct
UPDATE public.feedbacks f SET
  upvotes   = (SELECT COUNT(*) FROM public.feedback_votes WHERE feedback_id = f.id AND vote = 1),
  downvotes = (SELECT COUNT(*) FROM public.feedback_votes WHERE feedback_id = f.id AND vote = -1);

-- ===== 2. Comment likes =====

CREATE TABLE IF NOT EXISTS public.feedback_comment_likes (
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES feedback_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, comment_id)
);
ALTER TABLE public.feedback_comment_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fcl read"  ON public.feedback_comment_likes;
CREATE POLICY "fcl read"  ON public.feedback_comment_likes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "fcl write" ON public.feedback_comment_likes;
CREATE POLICY "fcl write" ON public.feedback_comment_likes FOR ALL    TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.feedback_comments ADD COLUMN IF NOT EXISTS likes_count INT DEFAULT 0;
ALTER TABLE public.feedback_comments ADD COLUMN IF NOT EXISTS parent_id   UUID REFERENCES public.feedback_comments(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.sync_comment_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.feedback_comments SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.comment_id;
  ELSE
    UPDATE public.feedback_comments SET likes_count = likes_count + 1 WHERE id = NEW.comment_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_comment_likes_count ON public.feedback_comment_likes;
CREATE TRIGGER trg_comment_likes_count
AFTER INSERT OR DELETE ON public.feedback_comment_likes
FOR EACH ROW EXECUTE FUNCTION public.sync_comment_likes_count();

-- ===== 3. Story reactions =====

CREATE TABLE IF NOT EXISTS public.story_reactions (
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  story_id   UUID REFERENCES stories(id)  ON DELETE CASCADE,
  emoji      TEXT NOT NULL DEFAULT '❤️',
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, story_id)
);
ALTER TABLE public.story_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sreact read"  ON public.story_reactions;
CREATE POLICY "sreact read"  ON public.story_reactions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "sreact write" ON public.story_reactions;
CREATE POLICY "sreact write" ON public.story_reactions FOR ALL    TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ===== 4. Story comments =====

CREATE TABLE IF NOT EXISTS public.story_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id   UUID NOT NULL REFERENCES stories(id)  ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.story_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scomment read"   ON public.story_comments;
CREATE POLICY "scomment read"   ON public.story_comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "scomment insert" ON public.story_comments;
CREATE POLICY "scomment insert" ON public.story_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
