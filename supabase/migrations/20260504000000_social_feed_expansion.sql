-- =============================================================================
-- FAF — Social Feed Expansion Migration
-- Timestamp: 20260504000000
-- Description: Adds all new tables, functions, triggers, RLS policies, and
--              storage buckets for the 9-segment expansion. Safe to re-run
--              thanks to IF NOT EXISTS / OR REPLACE guards throughout.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. EXTENSIONS (safe no-ops if already enabled)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. MODIFY EXISTING TABLES
-- ---------------------------------------------------------------------------

-- profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student'
  CHECK (role IN ('student', 'admin', 'vendor'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS follower_count INT NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS following_count INT NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- posts — forward-reference columns that depend on tables created below
-- We use deferred FK constraints or add them after the referenced tables exist.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_type TEXT NOT NULL DEFAULT 'feed'
  CHECK (post_type IN ('feed', 'anonymous', 'club', 'academic'));
ALTER TABLE posts ADD COLUMN IF NOT EXISTS repost_count INT NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS repost_of UUID;   -- FK added after posts self-ref is valid
ALTER TABLE posts ADD COLUMN IF NOT EXISTS club_id UUID;     -- FK added after clubs table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS study_group_id UUID; -- FK added after study_groups table

-- messages — disappearing DMs (only alter if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages') THEN
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. NEW TABLES (dependency order: no FK forward-refs)
-- ---------------------------------------------------------------------------

-- ===== 2.1 FOLLOWS =====
CREATE TABLE IF NOT EXISTS follows (
  follower_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower  ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- ===== 2.2 POST LIKES =====
CREATE TABLE IF NOT EXISTS post_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user ON post_likes(user_id);

-- ===== 2.3 POST COMMENTS =====
CREATE TABLE IF NOT EXISTS post_comments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body         TEXT NOT NULL CHECK (char_length(body) <= 500),
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id);

-- ===== 2.4 REPOSTS =====
CREATE TABLE IF NOT EXISTS reposts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quote_body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reposts_post ON reposts(post_id);

-- ===== 2.5 HASHTAGS =====
CREATE TABLE IF NOT EXISTS hashtags (
  id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS post_hashtags (
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  hashtag_id UUID NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, hashtag_id)
);
CREATE INDEX IF NOT EXISTS idx_post_hashtags_hashtag ON post_hashtags(hashtag_id);

CREATE TABLE IF NOT EXISTS trending_hashtags (
  hashtag_id UUID PRIMARY KEY REFERENCES hashtags(id) ON DELETE CASCADE,
  post_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 2.6 STORIES =====
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
CREATE INDEX IF NOT EXISTS idx_stories_author  ON stories(author_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at);

CREATE TABLE IF NOT EXISTS story_views (
  story_id  UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);

-- ===== 2.7 EVENTS =====
-- Create events table if it doesn't exist, then add columns if missing.
CREATE TABLE IF NOT EXISTS events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  description    TEXT,
  starts_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at        TIMESTAMPTZ,
  organizer_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  category       TEXT,
  cover_image_url TEXT,
  rsvp_count     INT NOT NULL DEFAULT 0,
  capacity       INT,
  is_public      BOOLEAN NOT NULL DEFAULT true,
  map_pin_x      FLOAT,
  map_pin_y      FLOAT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Add any columns that may be missing on an older events table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='description') THEN
    ALTER TABLE events ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='ends_at') THEN
    ALTER TABLE events ADD COLUMN ends_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='organizer_id') THEN
    ALTER TABLE events ADD COLUMN organizer_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='category') THEN
    ALTER TABLE events ADD COLUMN category TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='cover_image_url') THEN
    ALTER TABLE events ADD COLUMN cover_image_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='rsvp_count') THEN
    ALTER TABLE events ADD COLUMN rsvp_count INT NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='capacity') THEN
    ALTER TABLE events ADD COLUMN capacity INT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='is_public') THEN
    ALTER TABLE events ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='map_pin_x') THEN
    ALTER TABLE events ADD COLUMN map_pin_x FLOAT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='map_pin_y') THEN
    ALTER TABLE events ADD COLUMN map_pin_y FLOAT;
  END IF;
END $$;

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

-- ===== 2.8 MAP LOCATIONS =====
CREATE TABLE IF NOT EXISTS map_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('building', 'vendor', 'event_venue', 'landmark')),
  pin_x       FLOAT NOT NULL,
  pin_y       FLOAT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#a78bfa',
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='map_location_id') THEN
    ALTER TABLE events ADD COLUMN map_location_id UUID REFERENCES map_locations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ===== 2.9 CLUBS =====
CREATE TABLE IF NOT EXISTS clubs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  description  TEXT,
  category     TEXT NOT NULL,
  icon         TEXT,
  cover_url    TEXT,
  color        TEXT NOT NULL DEFAULT '#a78bfa',
  member_count INT NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS club_members (
  club_id   UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'admin')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_club_members_user ON club_members(user_id);

-- Patch missing columns on pre-existing clubs table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clubs' AND column_name='is_active') THEN
    ALTER TABLE clubs ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clubs' AND column_name='slug') THEN
    ALTER TABLE clubs ADD COLUMN slug TEXT UNIQUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clubs' AND column_name='category') THEN
    ALTER TABLE clubs ADD COLUMN category TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clubs' AND column_name='icon') THEN
    ALTER TABLE clubs ADD COLUMN icon TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clubs' AND column_name='cover_url') THEN
    ALTER TABLE clubs ADD COLUMN cover_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clubs' AND column_name='color') THEN
    ALTER TABLE clubs ADD COLUMN color TEXT NOT NULL DEFAULT '#a78bfa';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clubs' AND column_name='member_count') THEN
    ALTER TABLE clubs ADD COLUMN member_count INT NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clubs' AND column_name='created_by') THEN
    ALTER TABLE clubs ADD COLUMN created_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
  -- club_members role column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='club_members' AND column_name='role') THEN
    ALTER TABLE club_members ADD COLUMN role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'admin'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS club_announcements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_club_ann_club ON club_announcements(club_id);

-- Now add FK from posts to clubs (clubs table now exists)
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

-- ===== 2.10 ACADEMIC =====
CREATE TABLE IF NOT EXISTS courses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT NOT NULL,
  name       TEXT NOT NULL,
  department TEXT,
  level      TEXT,
  semester   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(code)
);

CREATE TABLE IF NOT EXISTS course_enrollments (
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
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
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- Now add FK from posts to study_groups
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

CREATE TABLE IF NOT EXISTS academic_resources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     UUID REFERENCES courses(id) ON DELETE SET NULL,
  uploader_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  file_url      TEXT NOT NULL,
  file_type     TEXT NOT NULL,
  file_size_kb  INT,
  resource_type TEXT NOT NULL DEFAULT 'note'
    CHECK (resource_type IN ('note', 'past_question', 'textbook', 'slide', 'other')),
  download_count INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resources_course    ON academic_resources(course_id);
CREATE INDEX IF NOT EXISTS idx_resources_uploader  ON academic_resources(uploader_id);

CREATE TABLE IF NOT EXISTS course_discussions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  parent_id  UUID REFERENCES course_discussions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_course_disc_course ON course_discussions(course_id);

-- ===== 2.11 VENDORS =====
CREATE TABLE IF NOT EXISTS vendors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,
  description     TEXT,
  icon            TEXT,
  logo_url        TEXT,
  location_text   TEXT NOT NULL,
  map_location_id UUID REFERENCES map_locations(id) ON DELETE SET NULL,
  is_approved     BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  approved_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendors_approved ON vendors(is_approved, is_active);

CREATE TABLE IF NOT EXISTS vendor_deals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id     UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  discount      TEXT NOT NULL,
  how_to_redeem TEXT NOT NULL DEFAULT 'Show FAF app',
  valid_from    TIMESTAMPTZ,
  valid_until   TIMESTAMPTZ,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendor_deals_vendor ON vendor_deals(vendor_id);

CREATE TABLE IF NOT EXISTS saved_deals (
  user_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  deal_id  UUID NOT NULL REFERENCES vendor_deals(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, deal_id)
);

-- ===== 2.12 NOTIFICATIONS =====
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  actor_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  entity_type TEXT,
  entity_id   UUID,
  body        TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifs_user ON notifications(user_id, is_read, created_at DESC);

-- ===== 2.13 ANONYMOUS POST AUDIT =====
-- Admin-only table. RLS blocks all direct access; only service_role can read.
CREATE TABLE IF NOT EXISTS anonymous_post_audit (
  post_id     UUID PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  real_author UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add self-ref FK on posts.repost_of (table exists at this point)
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

-- ---------------------------------------------------------------------------
-- 3. DATABASE FUNCTIONS
-- ---------------------------------------------------------------------------

-- 3.1 Follow counts
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

-- 3.2 Club member count
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

-- 3.3 RSVP count
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

-- 3.4 Post like / comment count triggers
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
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

CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
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

CREATE OR REPLACE FUNCTION update_post_repost_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
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

-- 3.5 Story view count trigger
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

-- 3.6 Study group member count
CREATE OR REPLACE FUNCTION update_study_group_member_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE study_groups SET member_count = member_count + 1 WHERE id = NEW.group_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE study_groups SET member_count = GREATEST(0, member_count - 1) WHERE id = OLD.group_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_study_group_member_count ON study_group_members;
CREATE TRIGGER trg_study_group_member_count
AFTER INSERT OR DELETE ON study_group_members
FOR EACH ROW EXECUTE FUNCTION update_study_group_member_count();

-- 3.7 Anonymous post audit trigger
-- Fires on every INSERT into posts where is_anonymous = true
-- Stores real author in audit table inaccessible to client
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

-- 3.8 Atomic like toggle RPC (replaces increment_likes)
CREATE OR REPLACE FUNCTION toggle_post_like(p_post_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user UUID := auth.uid();
  v_liked BOOLEAN;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM post_likes WHERE post_id = p_post_id AND user_id = v_user
  ) THEN
    DELETE FROM post_likes WHERE post_id = p_post_id AND user_id = v_user;
    v_liked := false;
  ELSE
    INSERT INTO post_likes (post_id, user_id) VALUES (p_post_id, v_user);
    v_liked := true;
  END IF;

  RETURN jsonb_build_object('liked', v_liked);
END;
$$;

-- 3.9 Increment resource download count
CREATE OR REPLACE FUNCTION increment_resource_download(p_resource_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE academic_resources
  SET download_count = download_count + 1
  WHERE id = p_resource_id;
$$;

-- 3.10 Delete expired stories and messages
CREATE OR REPLACE FUNCTION delete_expired_stories()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM stories WHERE expires_at < now();
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages') THEN
    DELETE FROM messages WHERE expires_at IS NOT NULL AND expires_at < now();
  END IF;
END $$;

-- 3.11 Refresh trending hashtags (call via scheduled function or cron)
CREATE OR REPLACE FUNCTION refresh_trending_hashtags()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Recompute from posts in the last 24 hours
  INSERT INTO trending_hashtags (hashtag_id, post_count, updated_at)
  SELECT
    ph.hashtag_id,
    COUNT(DISTINCT p.id) AS post_count,
    now()
  FROM post_hashtags ph
  JOIN posts p ON p.id = ph.post_id
  WHERE p.created_at > now() - INTERVAL '24 hours'
  GROUP BY ph.hashtag_id
  ON CONFLICT (hashtag_id) DO UPDATE
    SET post_count = EXCLUDED.post_count,
        updated_at = now();
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. VIEWS
-- ---------------------------------------------------------------------------

-- public_posts: hides author_id for anonymous posts at the database layer.
-- All client queries MUST use this view instead of the raw posts table.
CREATE OR REPLACE VIEW public_posts AS
  SELECT
    p.id,
    p.body,
    p.tags,
    p.image_url,
    p.is_anonymous,
    p.post_type,
    p.club_id,
    p.study_group_id,
    p.repost_of,
    p.repost_count,
    p.likes_count,
    p.comments_count,
    CASE WHEN p.is_anonymous THEN NULL ELSE p.author_id END AS author_id,
    p.created_at
  FROM posts p;

-- Grant SELECT on public_posts to authenticated and anon roles
GRANT SELECT ON public_posts TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY POLICIES
-- ---------------------------------------------------------------------------

-- === PROFILES ===
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles: anyone can read" ON profiles;
CREATE POLICY "profiles: anyone can read" ON profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles: own row update" ON profiles;
CREATE POLICY "profiles: own row update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- === POSTS ===
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts: read public" ON posts;
CREATE POLICY "posts: read public" ON posts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "posts: insert own" ON posts;
CREATE POLICY "posts: insert own" ON posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "posts: update own" ON posts;
CREATE POLICY "posts: update own" ON posts
  FOR UPDATE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "posts: delete own" ON posts;
CREATE POLICY "posts: delete own" ON posts
  FOR DELETE USING (auth.uid() = author_id);

-- === POST LIKES ===
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "likes: read all" ON post_likes;
CREATE POLICY "likes: read all" ON post_likes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "likes: own insert" ON post_likes;
CREATE POLICY "likes: own insert" ON post_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "likes: own delete" ON post_likes;
CREATE POLICY "likes: own delete" ON post_likes
  FOR DELETE USING (auth.uid() = user_id);

-- === POST COMMENTS ===
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments: read all" ON post_comments;
CREATE POLICY "comments: read all" ON post_comments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "comments: own insert" ON post_comments;
CREATE POLICY "comments: own insert" ON post_comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "comments: own delete" ON post_comments;
CREATE POLICY "comments: own delete" ON post_comments
  FOR DELETE USING (auth.uid() = author_id);

-- === REPOSTS ===
ALTER TABLE reposts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reposts: read all" ON reposts;
CREATE POLICY "reposts: read all" ON reposts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "reposts: own insert" ON reposts;
CREATE POLICY "reposts: own insert" ON reposts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reposts: own delete" ON reposts;
CREATE POLICY "reposts: own delete" ON reposts
  FOR DELETE USING (auth.uid() = user_id);

-- === HASHTAGS (public read) ===
ALTER TABLE hashtags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hashtags: read" ON hashtags;
CREATE POLICY "hashtags: read" ON hashtags
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "hashtags: insert authenticated" ON hashtags;
CREATE POLICY "hashtags: insert authenticated" ON hashtags
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE post_hashtags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_hashtags: read" ON post_hashtags;
CREATE POLICY "post_hashtags: read" ON post_hashtags
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "post_hashtags: insert authenticated" ON post_hashtags;
CREATE POLICY "post_hashtags: insert authenticated" ON post_hashtags
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE trending_hashtags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trending_hashtags: read" ON trending_hashtags;
CREATE POLICY "trending_hashtags: read" ON trending_hashtags
  FOR SELECT USING (true);

-- === STORIES ===
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stories: read non-expired" ON stories;
CREATE POLICY "stories: read non-expired" ON stories
  FOR SELECT USING (expires_at > now());

DROP POLICY IF EXISTS "stories: own insert" ON stories;
CREATE POLICY "stories: own insert" ON stories
  FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "stories: own delete" ON stories;
CREATE POLICY "stories: own delete" ON stories
  FOR DELETE USING (auth.uid() = author_id);

ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "story_views: own read" ON story_views;
CREATE POLICY "story_views: own read" ON story_views
  FOR SELECT USING (auth.uid() = viewer_id);

DROP POLICY IF EXISTS "story_views: insert" ON story_views;
CREATE POLICY "story_views: insert" ON story_views
  FOR INSERT WITH CHECK (auth.uid() = viewer_id);

-- === EVENTS ===
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events: read public" ON events;
CREATE POLICY "events: read public" ON events
  FOR SELECT USING (is_public = true);

DROP POLICY IF EXISTS "events: organizer insert" ON events;
CREATE POLICY "events: organizer insert" ON events
  FOR INSERT WITH CHECK (auth.uid() = organizer_id);

DROP POLICY IF EXISTS "events: organizer update" ON events;
CREATE POLICY "events: organizer update" ON events
  FOR UPDATE USING (auth.uid() = organizer_id);

DROP POLICY IF EXISTS "events: organizer delete" ON events;
CREATE POLICY "events: organizer delete" ON events
  FOR DELETE USING (auth.uid() = organizer_id);

ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rsvps: read" ON event_rsvps;
CREATE POLICY "rsvps: read" ON event_rsvps
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "rsvps: own insert" ON event_rsvps;
CREATE POLICY "rsvps: own insert" ON event_rsvps
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rsvps: own update" ON event_rsvps;
CREATE POLICY "rsvps: own update" ON event_rsvps
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "rsvps: own delete" ON event_rsvps;
CREATE POLICY "rsvps: own delete" ON event_rsvps
  FOR DELETE USING (auth.uid() = user_id);

-- === MAP LOCATIONS ===
ALTER TABLE map_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "map_locations: read active" ON map_locations;
CREATE POLICY "map_locations: read active" ON map_locations
  FOR SELECT USING (is_active = true);

-- Insert/Update/Delete only via service_role (admin console or Edge Function)

-- === FOLLOWS ===
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "follows: read" ON follows;
CREATE POLICY "follows: read" ON follows
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "follows: own insert" ON follows;
CREATE POLICY "follows: own insert" ON follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "follows: own delete" ON follows;
CREATE POLICY "follows: own delete" ON follows
  FOR DELETE USING (auth.uid() = follower_id);

-- === ANONYMOUS POST AUDIT (BLOCKED — service_role only) ===
ALTER TABLE anonymous_post_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_audit: deny all" ON anonymous_post_audit;
CREATE POLICY "anon_audit: deny all" ON anonymous_post_audit
  FOR ALL USING (false);
-- NOTE: service_role bypasses RLS by default. This policy blocks
-- authenticated and anon roles but the audit trigger (SECURITY DEFINER)
-- can still insert because it runs as the function owner.

-- === CLUBS ===
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clubs: read active" ON clubs;
CREATE POLICY "clubs: read active" ON clubs
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "clubs: admin insert" ON clubs;
CREATE POLICY "clubs: admin insert" ON clubs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "clubs: admin update" ON clubs;
CREATE POLICY "clubs: admin update" ON clubs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "club_members: read" ON club_members;
CREATE POLICY "club_members: read" ON club_members
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "club_members: own join" ON club_members;
CREATE POLICY "club_members: own join" ON club_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "club_members: own leave" ON club_members;
CREATE POLICY "club_members: own leave" ON club_members
  FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE club_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "club_ann: read" ON club_announcements;
CREATE POLICY "club_ann: read" ON club_announcements
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "club_ann: club admin post" ON club_announcements;
CREATE POLICY "club_ann: club admin post" ON club_announcements
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_id = club_announcements.club_id
        AND user_id = auth.uid()
        AND role IN ('admin', 'moderator')
    )
  );

-- === COURSES & ACADEMIC ===
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "courses: read" ON courses;
CREATE POLICY "courses: read" ON courses
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "courses: admin insert" ON courses;
CREATE POLICY "courses: admin insert" ON courses
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "enrollments: read" ON course_enrollments;
CREATE POLICY "enrollments: read" ON course_enrollments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "enrollments: own insert" ON course_enrollments;
CREATE POLICY "enrollments: own insert" ON course_enrollments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "enrollments: own delete" ON course_enrollments;
CREATE POLICY "enrollments: own delete" ON course_enrollments
  FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE study_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "study_groups: read" ON study_groups;
CREATE POLICY "study_groups: read" ON study_groups
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "study_groups: creator insert" ON study_groups;
CREATE POLICY "study_groups: creator insert" ON study_groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "study_groups: creator update" ON study_groups;
CREATE POLICY "study_groups: creator update" ON study_groups
  FOR UPDATE USING (auth.uid() = created_by);

ALTER TABLE study_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sgm: read" ON study_group_members;
CREATE POLICY "sgm: read" ON study_group_members
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "sgm: own join" ON study_group_members;
CREATE POLICY "sgm: own join" ON study_group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sgm: own leave" ON study_group_members;
CREATE POLICY "sgm: own leave" ON study_group_members
  FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE academic_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resources: read" ON academic_resources;
CREATE POLICY "resources: read" ON academic_resources
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "resources: own insert" ON academic_resources;
CREATE POLICY "resources: own insert" ON academic_resources
  FOR INSERT WITH CHECK (auth.uid() = uploader_id);

ALTER TABLE course_discussions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "discussions: read" ON course_discussions;
CREATE POLICY "discussions: read" ON course_discussions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "discussions: own insert" ON course_discussions;
CREATE POLICY "discussions: own insert" ON course_discussions
  FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "discussions: own delete" ON course_discussions;
CREATE POLICY "discussions: own delete" ON course_discussions
  FOR DELETE USING (auth.uid() = author_id);

-- === VENDORS ===
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- Approved vendors are visible to all; pending vendor is visible to its own owner too
DROP POLICY IF EXISTS "vendors: read approved" ON vendors;
CREATE POLICY "vendors: read approved" ON vendors
  FOR SELECT USING (
    (is_approved = true AND is_active = true)
    OR owner_id = auth.uid()
  );

DROP POLICY IF EXISTS "vendors: own insert" ON vendors;
CREATE POLICY "vendors: own insert" ON vendors
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "vendors: own update" ON vendors;
CREATE POLICY "vendors: own update" ON vendors
  FOR UPDATE USING (auth.uid() = owner_id);

ALTER TABLE vendor_deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deals: read active" ON vendor_deals;
CREATE POLICY "deals: read active" ON vendor_deals
  FOR SELECT USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM vendors
      WHERE id = vendor_deals.vendor_id AND is_approved = true
    )
  );

DROP POLICY IF EXISTS "deals: vendor owner insert" ON vendor_deals;
CREATE POLICY "deals: vendor owner insert" ON vendor_deals
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM vendors
      WHERE id = vendor_deals.vendor_id AND owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "deals: vendor owner update" ON vendor_deals;
CREATE POLICY "deals: vendor owner update" ON vendor_deals
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM vendors
      WHERE id = vendor_deals.vendor_id AND owner_id = auth.uid()
    )
  );

ALTER TABLE saved_deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_deals: own read" ON saved_deals;
CREATE POLICY "saved_deals: own read" ON saved_deals
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_deals: own insert" ON saved_deals;
CREATE POLICY "saved_deals: own insert" ON saved_deals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_deals: own delete" ON saved_deals;
CREATE POLICY "saved_deals: own delete" ON saved_deals
  FOR DELETE USING (auth.uid() = user_id);

-- === NOTIFICATIONS ===
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifs: own read" ON notifications;
CREATE POLICY "notifs: own read" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifs: own update" ON notifications;
CREATE POLICY "notifs: own update" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- INSERT is via service_role / DB triggers only — never from client directly.

-- ---------------------------------------------------------------------------
-- 6. STORAGE BUCKETS
-- Supabase storage buckets cannot be created via SQL migration on the hosted
-- platform. These INSERT statements work against the local storage schema.
-- For production, create buckets in the Supabase Dashboard or via the
-- Management API. Comments document the required configuration.
-- ---------------------------------------------------------------------------

-- stories     — public, 50MB, image/* and video/mp4
-- avatars     — public, 5MB, image/*
-- club-covers — public, 10MB, image/*
-- event-covers — public, 10MB, image/*
-- academic-resources — PRIVATE, 50MB, pdf/office/image
-- vendor-assets — public, 10MB, image/*
-- campus-map  — public, 20MB, image/*
-- posts-media already exists (public)

-- Storage RLS summary:
-- academic-resources: authenticated users can INSERT (uploader check in app).
--   SELECT requires a signed URL (1hr TTL) — bucket is private.
-- All other public buckets: SELECT open, INSERT requires auth.uid() match on path prefix.

-- ---------------------------------------------------------------------------
-- 7. CLEANUP: drop old increment_likes RPC if it exists
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS increment_likes(UUID);
