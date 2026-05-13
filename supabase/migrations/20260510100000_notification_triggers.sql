-- Migration: auto-create notification rows from DB events
-- Timestamp: 20260510100000
-- All trigger functions use SECURITY DEFINER to bypass client RLS on notifications.

-- ---------------------------------------------------------------------------
-- Helper: safe insert (skips self-notifications, skips missing users)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id    UUID,
  p_type       TEXT,
  p_actor_id   UUID    DEFAULT NULL,
  p_entity_type TEXT   DEFAULT NULL,
  p_entity_id  UUID    DEFAULT NULL,
  p_body       TEXT    DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  IF p_user_id = p_actor_id THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, type, actor_id, entity_type, entity_id, body)
  VALUES (p_user_id, p_type, p_actor_id, p_entity_type, p_entity_id, p_body);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 1. Like → notify post author
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_fn_like_notification()
RETURNS TRIGGER AS $$
DECLARE v_author UUID;
BEGIN
  SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
  PERFORM public.create_notification(v_author, 'like', NEW.user_id, 'post', NEW.post_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_like_notification ON public.post_likes;
CREATE TRIGGER trg_like_notification
AFTER INSERT ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_like_notification();

-- ---------------------------------------------------------------------------
-- 2. Comment → notify post author
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_fn_comment_notification()
RETURNS TRIGGER AS $$
DECLARE v_author UUID;
BEGIN
  SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
  PERFORM public.create_notification(v_author, 'comment', NEW.author_id, 'post', NEW.post_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_comment_notification ON public.post_comments;
CREATE TRIGGER trg_comment_notification
AFTER INSERT ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_comment_notification();

-- ---------------------------------------------------------------------------
-- 3. Follow → notify the followed user
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_fn_follow_notification()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.create_notification(NEW.following_id, 'follow', NEW.follower_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_follow_notification ON public.follows;
CREATE TRIGGER trg_follow_notification
AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_follow_notification();

-- ---------------------------------------------------------------------------
-- 4. Repost → notify original post author
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_fn_repost_notification()
RETURNS TRIGGER AS $$
DECLARE v_original_author UUID;
BEGIN
  IF NEW.repost_of IS NULL THEN RETURN NEW; END IF;
  SELECT author_id INTO v_original_author FROM public.posts WHERE id = NEW.repost_of;
  PERFORM public.create_notification(
    v_original_author, 'repost', NEW.author_id, 'post', NEW.repost_of
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_repost_notification ON public.posts;
CREATE TRIGGER trg_repost_notification
AFTER INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_repost_notification();

-- ---------------------------------------------------------------------------
-- 5. New message → notify the other conversation participant
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_fn_message_notification()
RETURNS TRIGGER AS $$
DECLARE v_recipient UUID;
BEGIN
  SELECT user_id INTO v_recipient
  FROM public.conversation_participants
  WHERE conversation_id = NEW.conversation_id
    AND user_id != NEW.sender_id
  LIMIT 1;

  PERFORM public.create_notification(
    v_recipient, 'new_message', NEW.sender_id,
    NULL, NULL, LEFT(NEW.body, 100)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_message_notification ON public.messages;
CREATE TRIGGER trg_message_notification
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_message_notification();

-- ---------------------------------------------------------------------------
-- RLS (ensure policies exist — safe to re-run)
-- ---------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifs: own read" ON public.notifications;
CREATE POLICY "notifs: own read" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifs: own update" ON public.notifications;
CREATE POLICY "notifs: own update" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());
