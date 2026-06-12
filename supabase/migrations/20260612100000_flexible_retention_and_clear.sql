-- 1. Insert default settings for flexible retention if not exists
INSERT INTO public.system_settings (key, value, updated_at)
VALUES 
  ('post_retention_value', '30'::jsonb, now()),
  ('post_retention_unit', '"days"'::jsonb, now()),
  ('story_retention_value', '24'::jsonb, now()),
  ('story_retention_unit', '"hours"'::jsonb, now()),
  ('chat_retention_value', '30'::jsonb, now()),
  ('chat_retention_unit', '"days"'::jsonb, now())
ON CONFLICT (key) DO NOTHING;

-- 2. Create function to set story expiration based on story_retention_value and story_retention_unit
CREATE OR REPLACE FUNCTION public.set_story_expiration()
RETURNS TRIGGER AS $$
DECLARE
  retention_val INT;
  retention_unit TEXT;
BEGIN
  SELECT (value#>>'{}')::int INTO retention_val FROM public.system_settings WHERE key = 'story_retention_value';
  SELECT (value#>>'{}')::text INTO retention_unit FROM public.system_settings WHERE key = 'story_retention_unit';
  
  IF NOT FOUND OR retention_val IS NULL THEN
    retention_val := 24;
  END IF;
  IF NOT FOUND OR retention_unit IS NULL THEN
    retention_unit := 'hours';
  END IF;

  -- Ensure only valid units are used to prevent SQL injection or syntax errors
  IF retention_unit NOT IN ('days', 'hours', 'minutes') THEN
    retention_unit := 'hours';
  END IF;

  NEW.expires_at := NEW.created_at + (retention_val || ' ' || retention_unit)::interval;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create database function to perform content cleanup (posts, stories, chats) with flexible interval units
CREATE OR REPLACE FUNCTION public.cleanup_expired_data()
RETURNS VOID AS $$
DECLARE
  post_val INT;
  post_unit TEXT;
  chat_val INT;
  chat_unit TEXT;
BEGIN
  -- Load post retention setting
  SELECT (value#>>'{}')::int INTO post_val FROM public.system_settings WHERE key = 'post_retention_value';
  SELECT (value#>>'{}')::text INTO post_unit FROM public.system_settings WHERE key = 'post_retention_unit';
  IF NOT FOUND OR post_val IS NULL THEN post_val := 30; END IF;
  IF NOT FOUND OR post_unit IS NULL OR post_unit NOT IN ('days', 'hours', 'minutes') THEN post_unit := 'days'; END IF;

  -- Load chat retention setting
  SELECT (value#>>'{}')::int INTO chat_val FROM public.system_settings WHERE key = 'chat_retention_value';
  SELECT (value#>>'{}')::text INTO chat_unit FROM public.system_settings WHERE key = 'chat_retention_unit';
  IF NOT FOUND OR chat_val IS NULL THEN chat_val := 30; END IF;
  IF NOT FOUND OR chat_unit IS NULL OR chat_unit NOT IN ('days', 'hours', 'minutes') THEN chat_unit := 'days'; END IF;

  -- Delete posts older than post_val post_unit
  DELETE FROM public.posts WHERE created_at < now() - (post_val || ' ' || post_unit)::interval;

  -- Delete expired stories
  DELETE FROM public.stories WHERE expires_at < now();

  -- Delete direct messages older than chat_val chat_unit
  DELETE FROM public.messages WHERE created_at < now() - (chat_val || ' ' || chat_unit)::interval;

  -- Delete group/club/study messages older than chat_val chat_unit
  DELETE FROM public.club_messages WHERE created_at < now() - (chat_val || ' ' || chat_unit)::interval;
  DELETE FROM public.study_group_messages WHERE created_at < now() - (chat_val || ' ' || chat_unit)::interval;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create database function to instantly clear all data of a specific type (admin command)
CREATE OR REPLACE FUNCTION public.clear_content_instantly(content_type TEXT)
RETURNS VOID AS $$
BEGIN
  IF content_type = 'posts' THEN
    DELETE FROM public.posts;
  ELSIF content_type = 'stories' THEN
    DELETE FROM public.stories;
  ELSIF content_type = 'chats' THEN
    DELETE FROM public.messages;
    DELETE FROM public.club_messages;
    DELETE FROM public.study_group_messages;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
