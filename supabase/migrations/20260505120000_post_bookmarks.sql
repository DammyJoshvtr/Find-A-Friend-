-- Post bookmarks table
CREATE TABLE IF NOT EXISTS post_bookmarks (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id    UUID        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, post_id)
);

ALTER TABLE post_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookmarks: own"
  ON post_bookmarks FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
