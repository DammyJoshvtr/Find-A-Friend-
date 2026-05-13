-- =============================================================================
-- FAF — Schema (BIGINT-compatible version)
-- Timestamp: 20260511030000
--
-- Replaces 20260504000000 + 20260510100000 for databases where posts.id
-- is BIGINT (not UUID). All FK references to posts(id) use BIGINT.
-- entity_id in notifications is TEXT to accommodate both BIGINT post IDs
-- and UUID event/club IDs.
--
-- Safe to re-run: IF NOT EXISTS / OR REPLACE guards throughout.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. PROFILES — add missing columns
-- ---------------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student'
  CHECK (role IN ('student', 'admin', 'vendor'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS follower_count  INT  NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS following_count INT  NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio        TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS level      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests  TEXT[] NOT NULL DEFAULT '{}';

-- ---------------------------------------------------------------------------
-- 2. POSTS — add missing columns (repost_of is BIGINT to match posts.id)
-- ---------------------------------------------------------------------------
ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_type TEXT NOT NULL DEFAULT 'feed'
  CHECK (post_type IN ('feed', 'anonymous', 'club', 'academic'));
ALTER TABLE posts ADD COLUMN IF NOT EXISTS repost_count  INT  NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_anonymous  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS likes_count   INT  NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS comments_count INT NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS club_id        UUID;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS study_group_id UUID;

-- repost_of must match posts.id type (BIGINT)
DO $$
BEGIN
  -- If repost_of was added as UUID from a previous failed run, drop and recreate it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'posts'
      AND column_name = 'repost_of' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE posts DROP COLUMN repost_of;
  END IF;
END $$;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS repost_of BIGINT;

-- messages — disappearing DMs
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'messages'
  ) THEN
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. NEW TABLES (dependency order)
-- ---------------------------------------------------------------------------

-- ===== FOLLOWS =====
CREATE TABLE IF NOT EXISTS follows (
  follower_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower  ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- ===== POST LIKES (post_id BIGINT) =====
CREATE TABLE IF NOT EXISTS post_likes (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    BIGINT  NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user ON post_likes(user_id);

-- ===== POST COMMENTS (post_id BIGINT) =====
CREATE TABLE IF NOT EXISTS post_comments (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      BIGINT  NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id    UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body         TEXT    NOT NULL CHECK (char_length(body) <= 500),
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id);

-- ===== REPOSTS (post_id BIGINT) =====
CREATE TABLE IF NOT EXISTS reposts (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    BIGINT  NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quote_body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reposts_post ON reposts(post_id);

-- ===== POST BOOKMARKS (post_id BIGINT) =====
CREATE TABLE IF NOT EXISTS post_bookmarks (
  post_id    BIGINT  NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_post_bookmarks_user ON post_bookmarks(user_id);

-- ===== HASHTAGS =====
CREATE TABLE IF NOT EXISTS hashtags (
  id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag TEXT NOT NULL UNIQUE
);

-- post_hashtags (post_id BIGINT)
CREATE TABLE IF NOT EXISTS post_hashtags (
  post_id    BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  hashtag_id UUID   NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, hashtag_id)
);
CREATE INDEX IF NOT EXISTS idx_post_hashtags_hashtag ON post_hashtags(hashtag_id);

CREATE TABLE IF NOT EXISTS trending_hashtags (
  hashtag_id UUID PRIMARY KEY REFERENCES hashtags(id) ON DELETE CASCADE,
  post_count INT  NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== STORIES =====
CREATE TABLE IF NOT EXISTS stories (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url     TEXT    NOT NULL,
  media_type    TEXT    NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  caption       TEXT,
  duration_secs INT     NOT NULL DEFAULT 5,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  view_count    INT     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stories_author  ON stories(author_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at);

CREATE TABLE IF NOT EXISTS story_views (
  story_id  UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);

-- ===== MAP LOCATIONS =====
CREATE TABLE IF NOT EXISTS map_locations (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT  NOT NULL,
  category    TEXT  NOT NULL CHECK (category IN ('building', 'vendor', 'event_venue', 'landmark')),
  pin_x       FLOAT NOT NULL,
  pin_y       FLOAT NOT NULL,
  color       TEXT  NOT NULL DEFAULT '#a78bfa',
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== EVENTS =====
CREATE TABLE IF NOT EXISTS events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT,
  starts_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at         TIMESTAMPTZ,
  organizer_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  category        TEXT,
  cover_image_url TEXT,
  rsvp_count      INT     NOT NULL DEFAULT 0,
  capacity        INT,
  is_public       BOOLEAN NOT NULL DEFAULT true,
  map_location_id UUID REFERENCES map_locations(id) ON DELETE SET NULL,
  map_pin_x       FLOAT,
  map_pin_y       FLOAT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_rsvps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going', 'interested', 'not_going')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_rsvps_event ON event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_user  ON event_rsvps(user_id);

-- ===== CLUBS =====
CREATE TABLE IF NOT EXISTS clubs (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT    NOT NULL,
  slug         TEXT    NOT NULL UNIQUE,
  description  TEXT,
  category     TEXT    NOT NULL,
  icon         TEXT,
  cover_url    TEXT,
  color        TEXT    NOT NULL DEFAULT '#a78bfa',
  member_count INT     NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_by   UUID    REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS club_members (
  club_id   UUID NOT NULL REFERENCES clubs(id)   ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'admin')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_club_members_user ON club_members(user_id);

CREATE TABLE IF NOT EXISTS club_announcements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    UUID NOT NULL REFERENCES clubs(id)   ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_club_ann_club ON club_announcements(club_id);

-- ===== ACADEMIC =====
CREATE TABLE IF NOT EXISTS courses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  department TEXT,
  level      TEXT,
  semester   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS course_enrollments (
  course_id UUID NOT NULL REFERENCES courses(id)  ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, user_id)
);

CREATE TABLE IF NOT EXISTS study_groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    UUID REFERENCES courses(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  venue        TEXT,
  meet_time    TIMESTAMPTZ,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  max_members  INT,
  member_count INT NOT NULL DEFAULT 0,
  created_by   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_study_groups_course ON study_groups(course_id);

CREATE TABLE IF NOT EXISTS study_group_members (
  group_id  UUID NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES profiles(id)     ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS academic_resources (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id      UUID REFERENCES courses(id) ON DELETE SET NULL,
  uploader_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT,
  file_url       TEXT NOT NULL,
  file_type      TEXT NOT NULL,
  file_size_kb   INT,
  resource_type  TEXT NOT NULL DEFAULT 'note'
    CHECK (resource_type IN ('note', 'past_question', 'textbook', 'slide', 'other')),
  download_count INT  NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS course_discussions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  UUID NOT NULL REFERENCES courses(id)  ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  parent_id  UUID REFERENCES course_discussions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== VENDORS =====
CREATE TABLE IF NOT EXISTS vendors (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID    REFERENCES profiles(id) ON DELETE SET NULL,
  name            TEXT    NOT NULL,
  category        TEXT    NOT NULL,
  description     TEXT,
  icon            TEXT,
  logo_url        TEXT,
  location_text   TEXT    NOT NULL,
  map_location_id UUID    REFERENCES map_locations(id) ON DELETE SET NULL,
  is_approved     BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  approved_by     UUID    REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendors_approved ON vendors(is_approved, is_active);

CREATE TABLE IF NOT EXISTS vendor_deals (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id     UUID    NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  title         TEXT    NOT NULL,
  description   TEXT,
  discount      TEXT    NOT NULL,
  how_to_redeem TEXT    NOT NULL DEFAULT 'Show FAF app',
  valid_from    TIMESTAMPTZ,
  valid_until   TIMESTAMPTZ,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saved_deals (
  user_id  UUID NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  deal_id  UUID NOT NULL REFERENCES vendor_deals(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, deal_id)
);

-- ===== NOTIFICATIONS =====
-- entity_id is TEXT (not UUID) to store both BIGINT post IDs and UUID event/club IDs
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT    NOT NULL,
  actor_id    UUID    REFERENCES profiles(id) ON DELETE SET NULL,
  entity_type TEXT,
  entity_id   TEXT,
  body        TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifs_user ON notifications(user_id, is_read, created_at DESC);

-- ===== ANONYMOUS POST AUDIT (post_id BIGINT) =====
CREATE TABLE IF NOT EXISTS anonymous_post_audit (
  post_id     BIGINT PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  real_author UUID   NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== REPORTS =====
CREATE TABLE IF NOT EXISTS reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID   NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id     BIGINT REFERENCES posts(id) ON DELETE CASCADE,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 4. DEFERRED FK CONSTRAINTS ON POSTS
-- ---------------------------------------------------------------------------

-- posts.repost_of → posts.id (BIGINT self-ref)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'posts_repost_of_fkey'
  ) THEN
    ALTER TABLE posts ADD CONSTRAINT posts_repost_of_fkey
      FOREIGN KEY (repost_of) REFERENCES posts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- posts.club_id → clubs.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'posts_club_id_fkey'
  ) THEN
    ALTER TABLE posts ADD CONSTRAINT posts_club_id_fkey
      FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- posts.study_group_id → study_groups.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'posts_study_group_id_fkey'
  ) THEN
    ALTER TABLE posts ADD CONSTRAINT posts_study_group_id_fkey
      FOREIGN KEY (study_group_id) REFERENCES study_groups(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. FUNCTIONS & TRIGGERS
-- ---------------------------------------------------------------------------

-- Follow counts
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    UPDATE profiles SET follower_count  = follower_count  + 1 WHERE id = NEW.following_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
    UPDATE profiles SET follower_count  = GREATEST(0, follower_count  - 1) WHERE id = OLD.following_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_follow_counts ON follows;
CREATE TRIGGER trg_follow_counts
AFTER INSERT OR DELETE ON follows
FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- Post like count
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_post_likes_count ON post_likes;
CREATE TRIGGER trg_post_likes_count
AFTER INSERT OR DELETE ON post_likes
FOR EACH ROW EXECUTE FUNCTION update_post_likes_count();

-- Post comment count
CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_post_comments_count ON post_comments;
CREATE TRIGGER trg_post_comments_count
AFTER INSERT OR DELETE ON post_comments
FOR EACH ROW EXECUTE FUNCTION update_post_comments_count();

-- Post repost count
CREATE OR REPLACE FUNCTION update_post_repost_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET repost_count = repost_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET repost_count = GREATEST(0, repost_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_post_repost_count ON reposts;
CREATE TRIGGER trg_post_repost_count
AFTER INSERT OR DELETE ON reposts
FOR EACH ROW EXECUTE FUNCTION update_post_repost_count();

-- Club member count
CREATE OR REPLACE FUNCTION update_club_member_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE clubs SET member_count = member_count + 1 WHERE id = NEW.club_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE clubs SET member_count = GREATEST(0, member_count - 1) WHERE id = OLD.club_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_club_member_count ON club_members;
CREATE TRIGGER trg_club_member_count
AFTER INSERT OR DELETE ON club_members
FOR EACH ROW EXECUTE FUNCTION update_club_member_count();

-- RSVP count
CREATE OR REPLACE FUNCTION update_rsvp_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'going' THEN
    UPDATE events SET rsvp_count = rsvp_count + 1 WHERE id = NEW.event_id;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'going' THEN
    UPDATE events SET rsvp_count = GREATEST(0, rsvp_count - 1) WHERE id = OLD.event_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'going' AND NEW.status != 'going' THEN
      UPDATE events SET rsvp_count = GREATEST(0, rsvp_count - 1) WHERE id = NEW.event_id;
    ELSIF OLD.status != 'going' AND NEW.status = 'going' THEN
      UPDATE events SET rsvp_count = rsvp_count + 1 WHERE id = NEW.event_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_rsvp_count ON event_rsvps;
CREATE TRIGGER trg_rsvp_count
AFTER INSERT OR UPDATE OR DELETE ON event_rsvps
FOR EACH ROW EXECUTE FUNCTION update_rsvp_count();

-- Story view count
CREATE OR REPLACE FUNCTION update_story_view_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE stories SET view_count = view_count + 1 WHERE id = NEW.story_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_story_view_count ON story_views;
CREATE TRIGGER trg_story_view_count
AFTER INSERT ON story_views
FOR EACH ROW EXECUTE FUNCTION update_story_view_count();

-- Atomic like toggle RPC
CREATE OR REPLACE FUNCTION toggle_post_like(p_post_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user  UUID := auth.uid();
  v_liked BOOLEAN;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM post_likes WHERE post_id = p_post_id AND user_id = v_user) THEN
    DELETE FROM post_likes WHERE post_id = p_post_id AND user_id = v_user;
    v_liked := false;
  ELSE
    INSERT INTO post_likes (post_id, user_id) VALUES (p_post_id, v_user);
    v_liked := true;
  END IF;
  RETURN jsonb_build_object('liked', v_liked);
END;
$$;

-- Anonymous post audit trigger
CREATE OR REPLACE FUNCTION audit_anonymous_post()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.is_anonymous = true THEN
    INSERT INTO anonymous_post_audit (post_id, real_author)
    VALUES (NEW.id, NEW.author_id)
    ON CONFLICT (post_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_anon_audit ON posts;
CREATE TRIGGER trg_anon_audit
AFTER INSERT ON posts
FOR EACH ROW EXECUTE FUNCTION audit_anonymous_post();

-- ---------------------------------------------------------------------------
-- 6. NOTIFICATION TRIGGER FUNCTIONS
-- entity_id stored as TEXT::text cast from BIGINT post ids
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id     UUID,
  p_type        TEXT,
  p_actor_id    UUID    DEFAULT NULL,
  p_entity_type TEXT    DEFAULT NULL,
  p_entity_id   TEXT    DEFAULT NULL,
  p_body        TEXT    DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  IF p_user_id = p_actor_id THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, type, actor_id, entity_type, entity_id, body)
  VALUES (p_user_id, p_type, p_actor_id, p_entity_type, p_entity_id, p_body);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Like notification
CREATE OR REPLACE FUNCTION public.trg_fn_like_notification()
RETURNS TRIGGER AS $$
DECLARE v_author UUID;
BEGIN
  SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
  PERFORM public.create_notification(v_author, 'like', NEW.user_id, 'post', NEW.post_id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_like_notification ON public.post_likes;
CREATE TRIGGER trg_like_notification
AFTER INSERT ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_like_notification();

-- Comment notification
CREATE OR REPLACE FUNCTION public.trg_fn_comment_notification()
RETURNS TRIGGER AS $$
DECLARE v_author UUID;
BEGIN
  SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
  PERFORM public.create_notification(v_author, 'comment', NEW.author_id, 'post', NEW.post_id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_comment_notification ON public.post_comments;
CREATE TRIGGER trg_comment_notification
AFTER INSERT ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_comment_notification();

-- Follow notification
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

-- Repost notification
CREATE OR REPLACE FUNCTION public.trg_fn_repost_notification()
RETURNS TRIGGER AS $$
DECLARE v_original_author UUID;
BEGIN
  IF NEW.repost_of IS NULL THEN RETURN NEW; END IF;
  SELECT author_id INTO v_original_author FROM public.posts WHERE id = NEW.repost_of;
  PERFORM public.create_notification(
    v_original_author, 'repost', NEW.author_id, 'post', NEW.repost_of::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_repost_notification ON public.posts;
CREATE TRIGGER trg_repost_notification
AFTER INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_repost_notification();

-- Message notification
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
-- 7. PUSH NOTIFICATION TRIGGER (calls Edge Function via pg_net)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.trg_fn_push_notification()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://vcbtvhociaioeyhhsczh.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer sb_publishable_oN3ImQ-mtGa2QgnBXQ-xqA_gP3GfVwe'
    ),
    body    := to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_push_notification ON public.notifications;
CREATE TRIGGER trg_push_notification
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_push_notification();

-- ---------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

-- PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles: anyone can read" ON profiles;
CREATE POLICY "profiles: anyone can read" ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "profiles: own row update" ON profiles;
CREATE POLICY "profiles: own row update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- POSTS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "posts: read public"  ON posts;
CREATE POLICY "posts: read public"  ON posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "posts: insert own"   ON posts;
CREATE POLICY "posts: insert own"   ON posts FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "posts: update own"   ON posts;
CREATE POLICY "posts: update own"   ON posts FOR UPDATE USING (auth.uid() = author_id);
DROP POLICY IF EXISTS "posts: delete own"   ON posts;
CREATE POLICY "posts: delete own"   ON posts FOR DELETE USING (auth.uid() = author_id);

-- POST LIKES
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "likes: read all"    ON post_likes;
CREATE POLICY "likes: read all"    ON post_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "likes: own insert"  ON post_likes;
CREATE POLICY "likes: own insert"  ON post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "likes: own delete"  ON post_likes;
CREATE POLICY "likes: own delete"  ON post_likes FOR DELETE USING (auth.uid() = user_id);

-- POST COMMENTS
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments: read all"   ON post_comments;
CREATE POLICY "comments: read all"   ON post_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "comments: own insert" ON post_comments;
CREATE POLICY "comments: own insert" ON post_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "comments: own delete" ON post_comments;
CREATE POLICY "comments: own delete" ON post_comments FOR DELETE USING (auth.uid() = author_id);

-- REPOSTS
ALTER TABLE reposts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reposts: read all"   ON reposts;
CREATE POLICY "reposts: read all"   ON reposts FOR SELECT USING (true);
DROP POLICY IF EXISTS "reposts: own insert" ON reposts;
CREATE POLICY "reposts: own insert" ON reposts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "reposts: own delete" ON reposts;
CREATE POLICY "reposts: own delete" ON reposts FOR DELETE USING (auth.uid() = user_id);

-- POST BOOKMARKS
ALTER TABLE post_bookmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bookmarks: own read"   ON post_bookmarks;
CREATE POLICY "bookmarks: own read"   ON post_bookmarks FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "bookmarks: own insert" ON post_bookmarks;
CREATE POLICY "bookmarks: own insert" ON post_bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "bookmarks: own delete" ON post_bookmarks;
CREATE POLICY "bookmarks: own delete" ON post_bookmarks FOR DELETE USING (auth.uid() = user_id);

-- FOLLOWS
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "follows: read"       ON follows;
CREATE POLICY "follows: read"       ON follows FOR SELECT USING (true);
DROP POLICY IF EXISTS "follows: own insert" ON follows;
CREATE POLICY "follows: own insert" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
DROP POLICY IF EXISTS "follows: own delete" ON follows;
CREATE POLICY "follows: own delete" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- STORIES
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stories: read non-expired" ON stories;
CREATE POLICY "stories: read non-expired" ON stories FOR SELECT USING (expires_at > now());
DROP POLICY IF EXISTS "stories: own insert" ON stories;
CREATE POLICY "stories: own insert" ON stories FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "stories: own delete" ON stories;
CREATE POLICY "stories: own delete" ON stories FOR DELETE USING (auth.uid() = author_id);

ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "story_views: own read" ON story_views;
CREATE POLICY "story_views: own read" ON story_views FOR SELECT USING (auth.uid() = viewer_id);
DROP POLICY IF EXISTS "story_views: insert"   ON story_views;
CREATE POLICY "story_views: insert"   ON story_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);

-- EVENTS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "events: read public"      ON events;
CREATE POLICY "events: read public"      ON events FOR SELECT USING (is_public = true);
DROP POLICY IF EXISTS "events: organizer insert" ON events;
CREATE POLICY "events: organizer insert" ON events FOR INSERT WITH CHECK (auth.uid() = organizer_id);
DROP POLICY IF EXISTS "events: organizer update" ON events;
CREATE POLICY "events: organizer update" ON events FOR UPDATE USING (auth.uid() = organizer_id);
DROP POLICY IF EXISTS "events: organizer delete" ON events;
CREATE POLICY "events: organizer delete" ON events FOR DELETE USING (auth.uid() = organizer_id);

ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rsvps: read"       ON event_rsvps;
CREATE POLICY "rsvps: read"       ON event_rsvps FOR SELECT USING (true);
DROP POLICY IF EXISTS "rsvps: own insert" ON event_rsvps;
CREATE POLICY "rsvps: own insert" ON event_rsvps FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "rsvps: own update" ON event_rsvps;
CREATE POLICY "rsvps: own update" ON event_rsvps FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "rsvps: own delete" ON event_rsvps;
CREATE POLICY "rsvps: own delete" ON event_rsvps FOR DELETE USING (auth.uid() = user_id);

-- MAP LOCATIONS
ALTER TABLE map_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "map_locations: read active" ON map_locations;
CREATE POLICY "map_locations: read active" ON map_locations FOR SELECT USING (is_active = true);

-- CLUBS
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clubs: read active" ON clubs;
CREATE POLICY "clubs: read active" ON clubs FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "clubs: admin insert" ON clubs;
CREATE POLICY "clubs: admin insert" ON clubs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "clubs: admin update" ON clubs;
CREATE POLICY "clubs: admin update" ON clubs FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "club_members: read"      ON club_members;
CREATE POLICY "club_members: read"      ON club_members FOR SELECT USING (true);
DROP POLICY IF EXISTS "club_members: own join"  ON club_members;
CREATE POLICY "club_members: own join"  ON club_members FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "club_members: own leave" ON club_members;
CREATE POLICY "club_members: own leave" ON club_members FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE club_announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "club_ann: read"           ON club_announcements;
CREATE POLICY "club_ann: read"           ON club_announcements FOR SELECT USING (true);
DROP POLICY IF EXISTS "club_ann: club admin post" ON club_announcements;
CREATE POLICY "club_ann: club admin post" ON club_announcements FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM club_members
    WHERE club_id = club_announcements.club_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'moderator')
  )
);

-- ACADEMIC
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "courses: read" ON courses;
CREATE POLICY "courses: read" ON courses FOR SELECT USING (true);

ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "enrollments: read"       ON course_enrollments;
CREATE POLICY "enrollments: read"       ON course_enrollments FOR SELECT USING (true);
DROP POLICY IF EXISTS "enrollments: own insert" ON course_enrollments;
CREATE POLICY "enrollments: own insert" ON course_enrollments FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "enrollments: own delete" ON course_enrollments;
CREATE POLICY "enrollments: own delete" ON course_enrollments FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE study_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "study_groups: read"           ON study_groups;
CREATE POLICY "study_groups: read"           ON study_groups FOR SELECT USING (true);
DROP POLICY IF EXISTS "study_groups: creator insert" ON study_groups;
CREATE POLICY "study_groups: creator insert" ON study_groups FOR INSERT WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "study_groups: creator update" ON study_groups;
CREATE POLICY "study_groups: creator update" ON study_groups FOR UPDATE USING (auth.uid() = created_by);

ALTER TABLE study_group_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sgm: read"      ON study_group_members;
CREATE POLICY "sgm: read"      ON study_group_members FOR SELECT USING (true);
DROP POLICY IF EXISTS "sgm: own join"  ON study_group_members;
CREATE POLICY "sgm: own join"  ON study_group_members FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "sgm: own leave" ON study_group_members;
CREATE POLICY "sgm: own leave" ON study_group_members FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE academic_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "resources: read"       ON academic_resources;
CREATE POLICY "resources: read"       ON academic_resources FOR SELECT USING (true);
DROP POLICY IF EXISTS "resources: own insert" ON academic_resources;
CREATE POLICY "resources: own insert" ON academic_resources FOR INSERT WITH CHECK (auth.uid() = uploader_id);

ALTER TABLE course_discussions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "discussions: read"       ON course_discussions;
CREATE POLICY "discussions: read"       ON course_discussions FOR SELECT USING (true);
DROP POLICY IF EXISTS "discussions: own insert" ON course_discussions;
CREATE POLICY "discussions: own insert" ON course_discussions FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "discussions: own delete" ON course_discussions;
CREATE POLICY "discussions: own delete" ON course_discussions FOR DELETE USING (auth.uid() = author_id);

-- VENDORS
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vendors: read approved" ON vendors;
CREATE POLICY "vendors: read approved" ON vendors FOR SELECT USING (
  (is_approved = true AND is_active = true) OR owner_id = auth.uid()
);
DROP POLICY IF EXISTS "vendors: own insert" ON vendors;
CREATE POLICY "vendors: own insert" ON vendors FOR INSERT WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "vendors: own update" ON vendors;
CREATE POLICY "vendors: own update" ON vendors FOR UPDATE USING (auth.uid() = owner_id);

ALTER TABLE vendor_deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deals: read active" ON vendor_deals;
CREATE POLICY "deals: read active" ON vendor_deals FOR SELECT USING (
  is_active = true AND EXISTS (
    SELECT 1 FROM vendors WHERE id = vendor_deals.vendor_id AND is_approved = true
  )
);
DROP POLICY IF EXISTS "deals: vendor owner insert" ON vendor_deals;
CREATE POLICY "deals: vendor owner insert" ON vendor_deals FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM vendors WHERE id = vendor_deals.vendor_id AND owner_id = auth.uid())
);

ALTER TABLE saved_deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saved_deals: own read"   ON saved_deals;
CREATE POLICY "saved_deals: own read"   ON saved_deals FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "saved_deals: own insert" ON saved_deals;
CREATE POLICY "saved_deals: own insert" ON saved_deals FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "saved_deals: own delete" ON saved_deals;
CREATE POLICY "saved_deals: own delete" ON saved_deals FOR DELETE USING (auth.uid() = user_id);

-- NOTIFICATIONS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifs: own read"   ON notifications;
CREATE POLICY "notifs: own read"   ON notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notifs: own update" ON notifications;
CREATE POLICY "notifs: own update" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- ANONYMOUS POST AUDIT (blocked from clients)
ALTER TABLE anonymous_post_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_audit: deny all" ON anonymous_post_audit;
CREATE POLICY "anon_audit: deny all" ON anonymous_post_audit FOR ALL USING (false);

-- REPORTS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reports: own insert" ON reports;
CREATE POLICY "reports: own insert" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- ---------------------------------------------------------------------------
-- 9. CLEANUP
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS increment_likes(UUID);
DROP FUNCTION IF EXISTS increment_likes(BIGINT);
