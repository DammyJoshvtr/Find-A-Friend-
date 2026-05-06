-- =============================================================================
-- FAF — Demo User Seed
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- Login: demo@faf.campus  |  Password: Demo1234!
-- =============================================================================

-- ─── 0. ENSURE EXTENSIONS ─────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── 1. ADD MISSING COLUMNS TO PROFILES ──────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name       TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio             TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS level           TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role            TEXT NOT NULL DEFAULT 'student';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS follower_count  INT NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS following_count INT NOT NULL DEFAULT 0;

-- ─── 2. ADD MISSING COLUMNS TO POSTS ─────────────────────────────────────────
-- Live table has: id(bigint), user_id, content, image_urls, hub_id,
--                 is_anonymous, likes_count, comments_count, created_at
-- App expects:    author_id, body, image_url, tags, post_type, repost_count, etc.
-- Strategy: add the columns the app needs, then backfill from existing columns.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS author_id      UUID;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS body           TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS tags           TEXT[]  DEFAULT '{}';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url      TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_type      TEXT    NOT NULL DEFAULT 'feed';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS repost_count   INT     NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS club_id        UUID;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS study_group_id UUID;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS repost_of      BIGINT;

-- Backfill: copy existing data into the columns the app reads
UPDATE posts SET author_id = user_id   WHERE author_id IS NULL AND user_id IS NOT NULL;
UPDATE posts SET body      = content   WHERE body = ''         AND content IS NOT NULL;

-- ─── 3. ENSURE SUPPORTING TABLES EXIST ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS follows (
  follower_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE TABLE IF NOT EXISTS hashtags (
  id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag TEXT NOT NULL UNIQUE
);

-- post_id is BIGINT to match the existing posts.id column type
CREATE TABLE IF NOT EXISTS post_hashtags (
  post_id    BIGINT NOT NULL,
  hashtag_id UUID   NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, hashtag_id)
);

CREATE TABLE IF NOT EXISTS trending_hashtags (
  hashtag_id UUID PRIMARY KEY REFERENCES hashtags(id) ON DELETE CASCADE,
  post_count INT  NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- post_id is BIGINT here too (no FK to avoid type-check errors on re-run)
CREATE TABLE IF NOT EXISTS post_bookmarks (
  user_id    UUID   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id    BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS clubs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  description  TEXT,
  category     TEXT NOT NULL DEFAULT 'General',
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
  role      TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, user_id)
);

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

CREATE TABLE IF NOT EXISTS events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT,
  starts_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at         TIMESTAMPTZ,
  organizer_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  category        TEXT,
  cover_image_url TEXT,
  rsvp_count      INT NOT NULL DEFAULT 0,
  capacity        INT,
  is_public       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vendors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,
  description   TEXT,
  icon          TEXT,
  logo_url      TEXT,
  location_text TEXT NOT NULL DEFAULT '',
  is_approved   BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vendor_deals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id     UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  discount      TEXT NOT NULL,
  how_to_redeem TEXT NOT NULL DEFAULT 'Show FAF app',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 4. CREATE DEMO USERS & DATA ──────────────────────────────────────────────
DO $seed$
DECLARE
  demo_id   UUID := 'a1b2c3d4-0000-0000-0000-000000000001';
  demo2_id  UUID := 'a1b2c3d4-0000-0000-0000-000000000002';
  p1_id     BIGINT;
  p2_id     BIGINT;
  p3_id     BIGINT;
  p4_id     BIGINT;
  p5_id     BIGINT;
BEGIN

  -- Auth users
  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, is_sso_user, is_anonymous
  ) VALUES
  (
    demo_id, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'demo@faf.campus',
    crypt('Demo1234!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Alex Johnson"}',
    now() - interval '30 days', now(), false, false
  ),
  (
    demo2_id, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'demo2@faf.campus',
    crypt('Demo1234!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Priya Okafor"}',
    now() - interval '20 days', now(), false, false
  )
  ON CONFLICT (id) DO NOTHING;

  -- Auth identities
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES
  (
    demo_id, demo_id,
    jsonb_build_object('sub', demo_id::text, 'email', 'demo@faf.campus'),
    'email', demo_id::text, now(), now(), now()
  ),
  (
    demo2_id, demo2_id,
    jsonb_build_object('sub', demo2_id::text, 'email', 'demo2@faf.campus'),
    'email', demo2_id::text, now(), now(), now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Profiles
  INSERT INTO profiles (id, full_name, bio, department, level, role, follower_count, following_count, is_online)
  VALUES
  (
    demo_id, 'Alex Johnson',
    '200L Engineering student 🔧 | Coffee addict ☕ | Building cool stuff',
    'Engineering', '200L', 'student', 14, 9, true
  ),
  (
    demo2_id, 'Priya Okafor',
    'Medicine | 300L | Loves biochem and campus vibes 🌸',
    'Medicine', '300L', 'student', 27, 18, false
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name       = EXCLUDED.full_name,
    bio             = EXCLUDED.bio,
    department      = EXCLUDED.department,
    level           = EXCLUDED.level,
    follower_count  = EXCLUDED.follower_count,
    following_count = EXCLUDED.following_count,
    is_online       = EXCLUDED.is_online;

  -- Posts: omit id so the serial sequence assigns it; capture with RETURNING
  INSERT INTO posts (author_id, body, tags, is_anonymous, post_type, likes_count, comments_count, repost_count, created_at)
  VALUES (
    demo_id,
    'Just finished my first Arduino project — built a mini weather station that texts you when it''s about to rain 🌧️ If anyone in Engineering wants to collaborate on something bigger, drop a message! #engineering #project #FAF',
    ARRAY['engineering','project','FAF'], false, 'feed', 12, 3, 1, now() - interval '2 days'
  ) RETURNING id INTO p1_id;

  INSERT INTO posts (author_id, body, tags, is_anonymous, post_type, likes_count, comments_count, repost_count, created_at)
  VALUES (
    demo_id,
    'The library WiFi on the 3rd floor is actually faster than anywhere else on campus. You''re welcome. 📡 #campushacks #FAF',
    ARRAY['campushacks','FAF'], false, 'feed', 34, 7, 5, now() - interval '5 days'
  ) RETURNING id INTO p2_id;

  INSERT INTO posts (author_id, body, tags, is_anonymous, post_type, likes_count, comments_count, repost_count, created_at)
  VALUES (
    demo2_id,
    'Anyone else think the anatomy lab smells like regret and ambition at the same time? 😭💀 Goodluck to everyone with exams this week! #medicine #examszn',
    ARRAY['medicine','examszn'], false, 'feed', 61, 12, 4, now() - interval '1 day'
  ) RETURNING id INTO p3_id;

  INSERT INTO posts (author_id, body, tags, is_anonymous, post_type, likes_count, comments_count, repost_count, created_at)
  VALUES (
    demo2_id,
    'Hot take: study groups only work if everyone actually did the reading beforehand. Change my mind. 📚 #studytips',
    ARRAY['studytips'], false, 'feed', 28, 9, 2, now() - interval '3 days'
  ) RETURNING id INTO p4_id;

  INSERT INTO posts (author_id, body, tags, is_anonymous, post_type, likes_count, comments_count, repost_count, created_at)
  VALUES (
    demo_id,
    'FAF is actually so useful for finding people in the same course 🙌 Already found 3 people to study with for my Algorithms midterm. Best thing to happen to campus this semester. #FAF #algorithms',
    ARRAY['FAF','algorithms'], false, 'feed', 19, 5, 0, now() - interval '12 hours'
  ) RETURNING id INTO p5_id;

  -- Follows
  INSERT INTO follows (follower_id, following_id, created_at) VALUES
    (demo_id,  demo2_id, now() - interval '15 days'),
    (demo2_id, demo_id,  now() - interval '10 days')
  ON CONFLICT DO NOTHING;

  -- Hashtags
  INSERT INTO hashtags (tag) VALUES
    ('engineering'), ('project'), ('campushacks'),
    ('medicine'), ('examszn'), ('studytips'), ('algorithms'), ('FAF')
  ON CONFLICT (tag) DO NOTHING;

  -- Post ↔ hashtag links
  INSERT INTO post_hashtags (post_id, hashtag_id)
  SELECT p1_id, id FROM hashtags WHERE tag IN ('engineering','project','FAF')
  ON CONFLICT DO NOTHING;

  INSERT INTO post_hashtags (post_id, hashtag_id)
  SELECT p2_id, id FROM hashtags WHERE tag IN ('campushacks','FAF')
  ON CONFLICT DO NOTHING;

  INSERT INTO post_hashtags (post_id, hashtag_id)
  SELECT p3_id, id FROM hashtags WHERE tag IN ('medicine','examszn')
  ON CONFLICT DO NOTHING;

  INSERT INTO post_hashtags (post_id, hashtag_id)
  SELECT p4_id, id FROM hashtags WHERE tag IN ('studytips')
  ON CONFLICT DO NOTHING;

  INSERT INTO post_hashtags (post_id, hashtag_id)
  SELECT p5_id, id FROM hashtags WHERE tag IN ('FAF','algorithms')
  ON CONFLICT DO NOTHING;

  -- Trending hashtags
  INSERT INTO trending_hashtags (hashtag_id, post_count, updated_at)
  SELECT id,
    CASE tag
      WHEN 'FAF'         THEN 3
      WHEN 'engineering' THEN 2
      WHEN 'medicine'    THEN 2
      ELSE 1
    END, now()
  FROM hashtags
  WHERE tag IN ('FAF','engineering','medicine','examszn','campushacks','studytips','algorithms','project')
  ON CONFLICT (hashtag_id) DO UPDATE SET
    post_count = EXCLUDED.post_count,
    updated_at = now();

END $seed$;

-- ─── 5. RICH CONTENT: CLUBS, COURSES, EVENTS, VENDORS ────────────────────────
DO $content$
DECLARE
  demo_id   UUID := 'a1b2c3d4-0000-0000-0000-000000000001';
  demo2_id  UUID := 'a1b2c3d4-0000-0000-0000-000000000002';

  club_tech  UUID := 'c0000000-0000-0000-0000-000000000001';
  club_med   UUID := 'c0000000-0000-0000-0000-000000000002';
  club_eng   UUID := 'c0000000-0000-0000-0000-000000000003';
  club_art   UUID := 'c0000000-0000-0000-0000-000000000004';
  club_deb   UUID := 'c0000000-0000-0000-0000-000000000005';

  course_dsa  UUID := 'd0000000-0000-0000-0000-000000000001';
  course_alg  UUID := 'd0000000-0000-0000-0000-000000000002';
  course_ckt  UUID := 'd0000000-0000-0000-0000-000000000003';
  course_ana  UUID := 'd0000000-0000-0000-0000-000000000004';

  event1  UUID := 'e0000000-0000-0000-0000-000000000001';
  event2  UUID := 'e0000000-0000-0000-0000-000000000002';
  event3  UUID := 'e0000000-0000-0000-0000-000000000003';

  vendor1 UUID := 'f0000000-0000-0000-0000-000000000001';
  vendor2 UUID := 'f0000000-0000-0000-0000-000000000002';
BEGIN

  -- ── Clubs ──────────────────────────────────────────────────────────────────
  INSERT INTO clubs (id, name, slug, description, category, icon, color, member_count, is_active, created_by)
  VALUES
  (
    club_tech, 'FAF Tech Club', 'faf-tech-club',
    'For developers, designers & innovators on campus. Weekly hackathons, workshops, and industry talks.',
    'Technology', '💻', '#60a5fa', 47, true, demo_id
  ),
  (
    club_med, 'Medical Students Association', 'medical-students',
    'Community for med students to share resources, study tips, and support each other through the journey.',
    'Healthcare', '🩺', '#34d399', 83, true, demo2_id
  ),
  (
    club_eng, 'Engineering Society', 'engineering-society',
    'Projects, seminars, and industry visits for all engineering students across all departments.',
    'Engineering', '⚙️', '#f59e0b', 61, true, demo_id
  ),
  (
    club_art, 'FAF Creatives', 'faf-creatives',
    'Visual arts, photography, music, and design. A safe space for campus creatives to collaborate.',
    'Arts', '🎨', '#f472b6', 38, true, demo2_id
  ),
  (
    club_deb, 'Debate & Oratory Club', 'debate-oratory',
    'Sharpen your arguments, public speaking, and critical thinking. Weekly sessions and inter-varsity competitions.',
    'Academic', '🎤', '#a78bfa', 29, true, demo_id
  )
  ON CONFLICT (id) DO NOTHING;

  -- Club members (demo users join clubs)
  INSERT INTO club_members (club_id, user_id, role, joined_at) VALUES
    (club_tech, demo_id,  'admin',  now() - interval '20 days'),
    (club_tech, demo2_id, 'member', now() - interval '5 days'),
    (club_med,  demo2_id, 'admin',  now() - interval '15 days'),
    (club_med,  demo_id,  'member', now() - interval '8 days'),
    (club_eng,  demo_id,  'admin',  now() - interval '30 days'),
    (club_art,  demo2_id, 'admin',  now() - interval '12 days'),
    (club_deb,  demo_id,  'member', now() - interval '7 days')
  ON CONFLICT DO NOTHING;

  -- ── Courses ────────────────────────────────────────────────────────────────
  INSERT INTO courses (id, code, name, department, level, semester)
  VALUES
  (
    course_dsa, 'CSC 201', 'Data Structures & Algorithms',
    'Computer Science', '200L', 'First'
  ),
  (
    course_alg, 'CSC 401', 'Advanced Algorithms',
    'Computer Science', '400L', 'First'
  ),
  (
    course_ckt, 'ENG 301', 'Circuit Theory & Electronics',
    'Engineering', '300L', 'Second'
  ),
  (
    course_ana, 'MED 201', 'Human Anatomy',
    'Medicine', '200L', 'First'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Course enrollments
  INSERT INTO course_enrollments (course_id, user_id) VALUES
    (course_dsa, demo_id),
    (course_alg, demo_id),
    (course_ckt, demo_id),
    (course_ana, demo2_id)
  ON CONFLICT DO NOTHING;

  -- ── Events ─────────────────────────────────────────────────────────────────
  INSERT INTO events (id, title, description, starts_at, ends_at, organizer_id, category, rsvp_count, capacity, is_public)
  VALUES
  (
    event1,
    'FAF Tech Week 2026',
    'Three days of workshops, hackathons, and tech talks from industry professionals. Open to all students!',
    now() + interval '7 days',
    now() + interval '10 days',
    demo_id, 'Technology', 54, 200, true
  ),
  (
    event2,
    'Inter-Departmental Quiz Night',
    'Test your knowledge across Science, Arts, Law, and more. Form a team of 4 and register before the event.',
    now() + interval '3 days',
    now() + interval '3 days' + interval '3 hours',
    demo2_id, 'Academic', 37, 120, true
  ),
  (
    event3,
    'FAF Campus Welcome Party 🎉',
    'The biggest welcome party of the semester. Live music, food stalls, and a chance to meet everyone on the app!',
    now() + interval '14 days',
    now() + interval '14 days' + interval '5 hours',
    demo_id, 'Social', 112, 500, true
  )
  ON CONFLICT (id) DO NOTHING;

  -- ── Vendors ────────────────────────────────────────────────────────────────
  INSERT INTO vendors (id, name, category, description, icon, location_text, is_approved, is_active, owner_id)
  VALUES
  (
    vendor1,
    'Campus Bites',
    'Food',
    'Affordable student meals, snacks, and fresh juice right at the main gate. Student-owned and operated.',
    '🍱',
    'Main gate, Block A entrance',
    true, true, demo2_id
  ),
  (
    vendor2,
    'Print Hub',
    'Services',
    'Fast printing, binding, and laminating. Coursework, projects, CVs — we handle it all.',
    '🖨️',
    'Faculty of Sciences, Ground floor',
    true, true, demo_id
  )
  ON CONFLICT (id) DO NOTHING;

  -- Vendor deals
  INSERT INTO vendor_deals (vendor_id, title, description, discount, how_to_redeem, is_active)
  VALUES
  (
    vendor1,
    '10% off for FAF users',
    'Show your FAF profile to the cashier and get 10% off any meal order.',
    '10%',
    'Show FAF app profile at cashier',
    true
  ),
  (
    vendor2,
    'Free cover page on any print job',
    'Get a free designed cover page when you print 10+ pages. Perfect for final year projects.',
    'Free cover page',
    'Tell the attendant you use FAF',
    true
  )
  ON CONFLICT DO NOTHING;

END $content$;
