-- Migration: Chat Streaks (Snapchat-style)
-- Creates chat_streaks table and record_chat_message RPC

-- ─── Table ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_streaks (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user2_id         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  streak_count     int         NOT NULL DEFAULT 0,
  longest_streak   int         NOT NULL DEFAULT 0,
  user1_sent_date  date,
  user2_sent_date  date,
  last_streak_date date,
  updated_at       timestamptz DEFAULT now(),
  UNIQUE(user1_id, user2_id),
  CHECK(user1_id < user2_id)
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.chat_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_streaks_select"
  ON public.chat_streaks FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "chat_streaks_insert"
  ON public.chat_streaks FOR INSERT
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "chat_streaks_update"
  ON public.chat_streaks FOR UPDATE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- ─── RPC ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_chat_message(
  other_user_id uuid,
  client_date   date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me          uuid := auth.uid();
  v_u1          uuid;
  v_u2          uuid;
  v_row         chat_streaks%ROWTYPE;
  v_u1_sent     date;
  v_u2_sent     date;
  v_streak      int  := 0;
  v_longest     int  := 0;
  v_last        date;
  v_at_risk     bool := false;
  v_increased   bool := false;
  v_i_am_u1    bool;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Canonical ordering: smaller UUID = user1
  IF v_me < other_user_id THEN
    v_u1 := v_me;
    v_u2 := other_user_id;
    v_i_am_u1 := true;
  ELSE
    v_u1 := other_user_id;
    v_u2 := v_me;
    v_i_am_u1 := false;
  END IF;

  -- Upsert the row (create if first message between these two users)
  INSERT INTO chat_streaks (user1_id, user2_id, streak_count, longest_streak, updated_at)
  VALUES (v_u1, v_u2, 0, 0, now())
  ON CONFLICT (user1_id, user2_id) DO NOTHING;

  -- Lock row for update
  SELECT * INTO v_row
  FROM chat_streaks
  WHERE user1_id = v_u1 AND user2_id = v_u2
  FOR UPDATE;

  v_streak  := COALESCE(v_row.streak_count, 0);
  v_longest := COALESCE(v_row.longest_streak, 0);
  v_last    := v_row.last_streak_date;
  v_u1_sent := v_row.user1_sent_date;
  v_u2_sent := v_row.user2_sent_date;

  -- Update the sender's sent date to today
  IF v_i_am_u1 THEN
    v_u1_sent := client_date;
  ELSE
    v_u2_sent := client_date;
  END IF;

  -- Streak logic
  IF v_u1_sent = client_date AND v_u2_sent = client_date THEN
    -- Both have sent today
    IF v_last IS NULL OR v_last < client_date THEN
      -- Streak day not yet counted for today → increment or start
      IF v_last IS NULL OR v_last < client_date - interval '1 day' THEN
        -- Streak was broken (gap > 1 day) → reset to 1
        v_streak    := 1;
        v_increased := true;
      ELSE
        -- Consecutive day → increment
        v_streak    := v_streak + 1;
        v_increased := true;
      END IF;
      v_last    := client_date;
      v_longest := GREATEST(v_streak, v_longest);
    END IF;
    v_at_risk := false;
  ELSE
    -- Only one side has sent → at risk
    v_at_risk := true;

    -- Check if streak is already broken (last_streak_date is before yesterday)
    IF v_last IS NOT NULL AND v_last < client_date - interval '1 day' THEN
      v_streak := 0;  -- broken
    END IF;
  END IF;

  -- Persist
  UPDATE chat_streaks
  SET
    user1_sent_date  = v_u1_sent,
    user2_sent_date  = v_u2_sent,
    streak_count     = v_streak,
    longest_streak   = v_longest,
    last_streak_date = v_last,
    updated_at       = now()
  WHERE user1_id = v_u1 AND user2_id = v_u2;

  RETURN json_build_object(
    'streak_count',   v_streak,
    'longest_streak', v_longest,
    'at_risk',        v_at_risk,
    'increased',      v_increased
  );
END;
$$;

-- ─── Helper: fetch streak between two users ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_chat_streak(other_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me  uuid := auth.uid();
  v_u1  uuid;
  v_u2  uuid;
  v_row chat_streaks%ROWTYPE;
  v_at_risk bool := false;
  today date := CURRENT_DATE;
BEGIN
  IF v_me IS NULL THEN RETURN NULL; END IF;

  IF v_me < other_user_id THEN v_u1 := v_me;  v_u2 := other_user_id;
  ELSE                          v_u1 := other_user_id; v_u2 := v_me; END IF;

  SELECT * INTO v_row
  FROM chat_streaks
  WHERE user1_id = v_u1 AND user2_id = v_u2;

  IF NOT FOUND THEN
    RETURN json_build_object('streak_count', 0, 'longest_streak', 0, 'at_risk', false);
  END IF;

  -- At risk = one side sent today, other hasn't yet
  v_at_risk := (
    (v_row.user1_sent_date = today OR v_row.user2_sent_date = today) AND
    NOT (v_row.user1_sent_date = today AND v_row.user2_sent_date = today)
  );

  -- Broken streak (missed a day)
  IF v_row.last_streak_date IS NOT NULL AND v_row.last_streak_date < today - interval '1 day' AND
     NOT (v_row.user1_sent_date = today OR v_row.user2_sent_date = today) THEN
    -- Auto-reset display (don't write, write happens on next message)
    RETURN json_build_object('streak_count', 0, 'longest_streak', v_row.longest_streak, 'at_risk', false);
  END IF;

  RETURN json_build_object(
    'streak_count',   v_row.streak_count,
    'longest_streak', v_row.longest_streak,
    'at_risk',        v_at_risk
  );
END;
$$;
