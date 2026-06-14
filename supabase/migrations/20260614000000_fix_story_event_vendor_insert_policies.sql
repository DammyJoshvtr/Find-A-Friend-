-- =============================================================================
-- Migration: Fix insert policies for stories, events, and vendor applications
-- Date: 20260614000000
--
-- Problem: Users are unable to:
--   1. Post stories
--   2. Create events
--   3. Apply as a vendor
--
-- Root causes addressed:
--   a) story_views: Missing UPDATE policy breaks upsert (markStoryViewed)
--   b) Ensure stories/events/vendors insert policies are present and correct
--   c) Ensure storage bucket RLS allows uploads from own folder
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. story_views: Add missing UPDATE policy for upsert support
--    (Supabase upsert requires INSERT + UPDATE policies)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "story_views: own upsert update" ON public.story_views;
CREATE POLICY "story_views: own upsert update" ON public.story_views
  FOR UPDATE
  USING (viewer_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Ensure stories insert policy is correct (re-create to be safe)
-- ---------------------------------------------------------------------------

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stories: own insert" ON public.stories;
CREATE POLICY "stories: own insert" ON public.stories
  FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- ---------------------------------------------------------------------------
-- 3. Ensure events insert policy is correct (re-create to be safe)
-- ---------------------------------------------------------------------------

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events: organizer insert" ON public.events;
CREATE POLICY "events: organizer insert" ON public.events
  FOR INSERT
  WITH CHECK (auth.uid() = organizer_id);

-- ---------------------------------------------------------------------------
-- 4. Ensure vendors insert policy is correct (re-create to be safe)
-- ---------------------------------------------------------------------------

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendors: own insert" ON public.vendors;
CREATE POLICY "vendors: own insert" ON public.vendors
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- 5. Storage: Ensure event-covers bucket allows authenticated uploads
--    (overwrite if policy exists — use idempotent DO block)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'event-covers: auth insert'
  ) THEN
    CREATE POLICY "event-covers: auth insert"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'event-covers' AND auth.role() = 'authenticated');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Storage: Ensure vendor-assets bucket allows authenticated uploads
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'vendor-assets: own insert'
  ) THEN
    CREATE POLICY "vendor-assets: own insert"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'vendor-assets'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Storage: Ensure stories bucket allows authenticated uploads from own folder
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'stories: own insert'
  ) THEN
    CREATE POLICY "stories: own insert"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'stories'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;
