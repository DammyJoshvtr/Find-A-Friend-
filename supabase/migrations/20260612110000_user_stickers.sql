CREATE TABLE IF NOT EXISTS user_stickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  media_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE user_stickers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own stickers"
  ON user_stickers
  FOR ALL
  USING (auth.uid() = user_id);
