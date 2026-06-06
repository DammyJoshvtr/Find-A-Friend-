-- Keep feedbacks.upvotes / feedbacks.downvotes in sync with feedback_votes.
-- SECURITY DEFINER lets the trigger update any feedback row regardless of RLS
-- (the UPDATE policy only allows authors to update their own rows directly).

CREATE OR REPLACE FUNCTION public.sync_feedback_votes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote = 1 THEN
      UPDATE public.feedbacks SET upvotes   = upvotes   + 1 WHERE id = NEW.feedback_id;
    ELSE
      UPDATE public.feedbacks SET downvotes = downvotes + 1 WHERE id = NEW.feedback_id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote = 1 THEN
      UPDATE public.feedbacks SET upvotes   = GREATEST(0, upvotes   - 1) WHERE id = OLD.feedback_id;
    ELSE
      UPDATE public.feedbacks SET downvotes = GREATEST(0, downvotes - 1) WHERE id = OLD.feedback_id;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Vote flipped (+1 → -1 or -1 → +1)
    IF OLD.vote = 1 AND NEW.vote = -1 THEN
      UPDATE public.feedbacks
        SET upvotes   = GREATEST(0, upvotes   - 1),
            downvotes = downvotes + 1
        WHERE id = NEW.feedback_id;
    ELSIF OLD.vote = -1 AND NEW.vote = 1 THEN
      UPDATE public.feedbacks
        SET downvotes = GREATEST(0, downvotes - 1),
            upvotes   = upvotes   + 1
        WHERE id = NEW.feedback_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_feedback_votes_count ON public.feedback_votes;
CREATE TRIGGER trg_feedback_votes_count
  AFTER INSERT OR UPDATE OR DELETE ON public.feedback_votes
  FOR EACH ROW EXECUTE FUNCTION public.sync_feedback_votes_count();

-- Backfill: recalculate counts from all existing votes so the columns are accurate now.
UPDATE public.feedbacks f SET
  upvotes   = COALESCE((SELECT COUNT(*) FROM public.feedback_votes WHERE feedback_id = f.id AND vote =  1), 0),
  downvotes = COALESCE((SELECT COUNT(*) FROM public.feedback_votes WHERE feedback_id = f.id AND vote = -1), 0);
