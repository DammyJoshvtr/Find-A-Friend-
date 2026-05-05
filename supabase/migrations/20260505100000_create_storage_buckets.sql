-- Create all required storage buckets (idempotent: skips if already exists).
-- Run in the Supabase Dashboard → SQL Editor, or via supabase db push.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('stories',             'stories',             true,  52428800, ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime']),
  ('avatars',             'avatars',             true,   5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('club-covers',         'club-covers',         true,  10485760, ARRAY['image/jpeg','image/png','image/webp']),
  ('event-covers',        'event-covers',        true,  10485760, ARRAY['image/jpeg','image/png','image/webp']),
  ('academic-resources',  'academic-resources',  false, 52428800, ARRAY['image/jpeg','image/png','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('vendor-assets',       'vendor-assets',       true,  10485760, ARRAY['image/jpeg','image/png','image/webp']),
  ('campus-map',          'campus-map',          true,  20971520, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- ── RLS policies ────────────────────────────────────────────────────────────

-- stories: public read, authenticated upload to own folder
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

-- avatars: public read, authenticated upload to own folder
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='avatars: public read'
  ) THEN
    CREATE POLICY "avatars: public read"
      ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='avatars: own insert'
  ) THEN
    CREATE POLICY "avatars: own insert"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='avatars: own update'
  ) THEN
    CREATE POLICY "avatars: own update"
      ON storage.objects FOR UPDATE
      USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

-- club-covers: public read, authenticated insert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='club-covers: public read'
  ) THEN
    CREATE POLICY "club-covers: public read"
      ON storage.objects FOR SELECT USING (bucket_id = 'club-covers');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='club-covers: auth insert'
  ) THEN
    CREATE POLICY "club-covers: auth insert"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'club-covers' AND auth.role() = 'authenticated');
  END IF;
END $$;

-- event-covers: public read, authenticated insert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='event-covers: public read'
  ) THEN
    CREATE POLICY "event-covers: public read"
      ON storage.objects FOR SELECT USING (bucket_id = 'event-covers');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='event-covers: auth insert'
  ) THEN
    CREATE POLICY "event-covers: auth insert"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'event-covers' AND auth.role() = 'authenticated');
  END IF;
END $$;

-- vendor-assets: public read, authenticated insert to own folder
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='vendor-assets: public read'
  ) THEN
    CREATE POLICY "vendor-assets: public read"
      ON storage.objects FOR SELECT USING (bucket_id = 'vendor-assets');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='vendor-assets: own insert'
  ) THEN
    CREATE POLICY "vendor-assets: own insert"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'vendor-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

-- academic-resources: private bucket — authenticated insert, signed-URL read
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='academic-resources: auth insert'
  ) THEN
    CREATE POLICY "academic-resources: auth insert"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'academic-resources' AND auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='academic-resources: auth select'
  ) THEN
    CREATE POLICY "academic-resources: auth select"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'academic-resources' AND auth.role() = 'authenticated');
  END IF;
END $$;

-- campus-map: public read, no client insert (managed by admin)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='campus-map: public read'
  ) THEN
    CREATE POLICY "campus-map: public read"
      ON storage.objects FOR SELECT USING (bucket_id = 'campus-map');
  END IF;
END $$;
