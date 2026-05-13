-- Live game sessions for real-time multiplayer
-- Run this in Supabase SQL Editor: Dashboard → SQL Editor → New query → paste → Run

CREATE TABLE IF NOT EXISTS live_game_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type   text NOT NULL CHECK (game_type IN ('pool', 'trivia', 'wordle')),
  host_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  guest_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status      text NOT NULL DEFAULT 'waiting'
                CHECK (status IN ('waiting', 'active', 'paused', 'finished')),
  state       jsonb NOT NULL DEFAULT '{}',
  host_score  integer NOT NULL DEFAULT 0,
  guest_score integer NOT NULL DEFAULT 0,
  winner_id   uuid REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_live_session_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_live_session_ts ON live_game_sessions;
CREATE TRIGGER trg_live_session_ts
  BEFORE UPDATE ON live_game_sessions
  FOR EACH ROW EXECUTE FUNCTION update_live_session_timestamp();

-- Row Level Security
ALTER TABLE live_game_sessions ENABLE ROW LEVEL SECURITY;

-- Players in a session can see and modify it
CREATE POLICY "session participants can select"
  ON live_game_sessions FOR SELECT
  USING (auth.uid() = host_id OR auth.uid() = guest_id);

CREATE POLICY "host can insert"
  ON live_game_sessions FOR INSERT
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "participants can update"
  ON live_game_sessions FOR UPDATE
  USING (auth.uid() = host_id OR auth.uid() = guest_id);

-- Anyone can see waiting sessions (to join)
CREATE POLICY "anyone can see waiting sessions"
  ON live_game_sessions FOR SELECT
  USING (status = 'waiting');

-- Enable realtime on this table
ALTER PUBLICATION supabase_realtime ADD TABLE live_game_sessions;
