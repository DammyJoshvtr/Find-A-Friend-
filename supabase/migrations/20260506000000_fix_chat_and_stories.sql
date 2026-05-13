-- Fix: RLS policies for chat tables + stories storage bucket
-- Run in Supabase Dashboard → SQL Editor

-- ─── 0. HELPERS ─────────────────────────────────────────────────────────────

-- Helper to check participation without recursion (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_chat_participant(p_conv_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = p_conv_id
      AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 1. CONVERSATIONS ───────────────────────────────────────────────────────

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations: participant read" ON conversations;
CREATE POLICY "conversations: participant read" ON conversations
  FOR SELECT USING (is_chat_participant(id));

DROP POLICY IF EXISTS "conversations: authenticated insert" ON conversations;
CREATE POLICY "conversations: authenticated insert" ON conversations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "conversations: participant update" ON conversations;
CREATE POLICY "conversations: participant update" ON conversations
  FOR UPDATE USING (is_chat_participant(id));

-- ─── 2. CONVERSATION PARTICIPANTS ───────────────────────────────────────────

ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conv_participants: participant read" ON conversation_participants;
CREATE POLICY "conv_participants: participant read" ON conversation_participants
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_chat_participant(conversation_id)
  );

DROP POLICY IF EXISTS "conv_participants: authenticated insert" ON conversation_participants;
CREATE POLICY "conv_participants: authenticated insert" ON conversation_participants
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "conv_participants: own delete" ON conversation_participants;
CREATE POLICY "conv_participants: own delete" ON conversation_participants
  FOR DELETE USING (user_id = auth.uid());

-- ─── 3. MESSAGES ────────────────────────────────────────────────────────────

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages: participant read" ON messages;
CREATE POLICY "messages: participant read" ON messages
  FOR SELECT USING (is_chat_participant(conversation_id));

DROP POLICY IF EXISTS "messages: participant insert" ON messages;
CREATE POLICY "messages: participant insert" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND is_chat_participant(conversation_id)
  );

DROP POLICY IF EXISTS "messages: own delete" ON messages;
CREATE POLICY "messages: own delete" ON messages
  FOR DELETE USING (sender_id = auth.uid());

-- ─── 4. STORIES TABLE (create if missing) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS stories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url     TEXT NOT NULL,
  media_type    TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  caption       TEXT,
  duration_secs INT NOT NULL DEFAULT 5,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  view_count    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS story_views (
  story_id  UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stories: read non-expired" ON stories;
CREATE POLICY "stories: read non-expired" ON stories
  FOR SELECT USING (expires_at > now());

DROP POLICY IF EXISTS "stories: own insert" ON stories;
CREATE POLICY "stories: own insert" ON stories
  FOR INSERT WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "stories: own delete" ON stories;
CREATE POLICY "stories: own delete" ON stories
  FOR DELETE USING (author_id = auth.uid());

ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "story_views: read all" ON story_views;
CREATE POLICY "story_views: read all" ON story_views
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "story_views: own insert" ON story_views;
CREATE POLICY "story_views: own insert" ON story_views
  FOR INSERT WITH CHECK (viewer_id = auth.uid());

-- ─── 5. STORIES STORAGE BUCKET ──────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'stories', 'stories', true, 52428800,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='stories: public read'
  ) THEN
    CREATE POLICY "stories: public read"
      ON storage.objects FOR SELECT USING (bucket_id = 'stories');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='stories: own insert'
  ) THEN
    CREATE POLICY "stories: own insert"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='stories: own delete'
  ) THEN
    CREATE POLICY "stories: own delete"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;
