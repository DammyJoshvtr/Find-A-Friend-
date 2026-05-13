-- Migration: add is_read to messages for delivered/seen indicators
-- Timestamp: 20260511040000

ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;

-- Allow any conversation participant to mark messages as read (UPDATE)
DROP POLICY IF EXISTS "messages: participant update" ON messages;
CREATE POLICY "messages: participant update" ON messages
  FOR UPDATE USING (public.is_chat_participant(conversation_id));

-- Enable realtime on messages table so UPDATE events broadcast to subscribers
-- (INSERT was already working; UPDATE needs the replica identity)
ALTER TABLE messages REPLICA IDENTITY FULL;
