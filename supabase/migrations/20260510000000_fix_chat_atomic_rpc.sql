-- Migration to fix chat RLS and provide an atomic conversation creation RPC
-- Includes table creation if they don't exist yet.
-- Timestamp: 20260510000000

-- 1. Create Base Chat Tables (if missing)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  is_group BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- 2. Ensure RLS is enabled
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 3. Add created_by to conversations if missing (for projects where table already existed)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='created_by') THEN
    ALTER TABLE public.conversations ADD COLUMN created_by UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- 4. Update/Create is_chat_participant helper
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

-- 5. Update RLS policies for conversations
DROP POLICY IF EXISTS "conversations: participant read" ON public.conversations;
CREATE POLICY "conversations: participant read" ON public.conversations
  FOR SELECT USING (
    public.is_chat_participant(id)
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "conversations: authenticated insert" ON public.conversations;
CREATE POLICY "conversations: authenticated insert" ON public.conversations
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND (created_by IS NULL OR created_by = auth.uid())
  );

-- 6. Update RLS for participants
DROP POLICY IF EXISTS "conv_participants: participant read" ON public.conversation_participants;
CREATE POLICY "conv_participants: participant read" ON public.conversation_participants
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_chat_participant(conversation_id)
  );

DROP POLICY IF EXISTS "conv_participants: authenticated insert" ON public.conversation_participants;
CREATE POLICY "conv_participants: authenticated insert" ON public.conversation_participants
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 7. Update RLS for messages
DROP POLICY IF EXISTS "messages: participant read" ON public.messages;
CREATE POLICY "messages: participant read" ON public.messages
  FOR SELECT USING (public.is_chat_participant(conversation_id));

DROP POLICY IF EXISTS "messages: participant insert" ON public.messages;
CREATE POLICY "messages: participant insert" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND public.is_chat_participant(conversation_id)
  );

-- 8. Atomic RPC to handle direct conversation creation/lookup
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(p_other_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_conv_id UUID;
  v_my_id UUID := auth.uid();
  v_other_name TEXT;
BEGIN
  IF v_my_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Check if a 1:1 conversation already exists
  SELECT cp.conversation_id INTO v_conv_id
  FROM public.conversation_participants cp
  JOIN public.conversations c ON c.id = cp.conversation_id
  WHERE c.is_group = false
    AND cp.user_id = v_my_id
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp2
      WHERE cp2.conversation_id = cp.conversation_id
        AND cp2.user_id = p_other_user_id
    )
  LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  -- 2. Fetch other user's name for the conversation name
  SELECT full_name INTO v_other_name FROM public.profiles WHERE id = p_other_user_id;

  -- 3. Create new conversation
  INSERT INTO public.conversations (name, is_group, created_by)
  VALUES (COALESCE(v_other_name, 'Direct Chat'), false, v_my_id)
  RETURNING id INTO v_conv_id;

  -- 4. Add participants
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_conv_id, v_my_id), (v_conv_id, p_other_user_id);

  RETURN v_conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
