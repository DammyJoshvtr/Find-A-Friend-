-- Migration: push notifications for feedback events
-- Timestamp: 20260514000000

-- ---------------------------------------------------------------------------
-- 1. Feedback comment → notify the feedback author
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_fn_feedback_comment_notification()
RETURNS TRIGGER AS $$
DECLARE v_author UUID;
BEGIN
  SELECT author_id INTO v_author FROM public.feedbacks WHERE id = NEW.feedback_id;
  PERFORM public.create_notification(
    v_author,
    'feedback_comment',
    NEW.author_id,
    'feedback',
    NEW.feedback_id,
    LEFT(NEW.body, 100)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_feedback_comment_notification ON public.feedback_comments;
CREATE TRIGGER trg_feedback_comment_notification
AFTER INSERT ON public.feedback_comments
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_feedback_comment_notification();

-- ---------------------------------------------------------------------------
-- 2. Feedback upvote → notify the feedback author
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_fn_feedback_upvote_notification()
RETURNS TRIGGER AS $$
DECLARE v_author UUID;
BEGIN
  IF NEW.vote != 1 THEN RETURN NEW; END IF;
  SELECT author_id INTO v_author FROM public.feedbacks WHERE id = NEW.feedback_id;
  PERFORM public.create_notification(
    v_author,
    'feedback_upvote',
    NEW.user_id,
    'feedback',
    NEW.feedback_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_feedback_upvote_notification ON public.feedback_votes;
CREATE TRIGGER trg_feedback_upvote_notification
AFTER INSERT ON public.feedback_votes
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_feedback_upvote_notification();
