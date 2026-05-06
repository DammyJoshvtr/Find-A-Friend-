-- Ensure posts-media bucket exists (idempotent).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('posts-media', 'posts-media', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Public read
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='posts-media: public read'
  ) THEN
    CREATE POLICY "posts-media: public read"
      ON storage.objects FOR SELECT USING (bucket_id = 'posts-media');
  END IF;
END $$;

-- Authenticated users can upload to their own folder
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='posts-media: own insert'
  ) THEN
    CREATE POLICY "posts-media: own insert"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'posts-media' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

-- Authenticated users can delete their own uploads
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='posts-media: own delete'
  ) THEN
    CREATE POLICY "posts-media: own delete"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'posts-media' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;
