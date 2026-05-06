-- Drop the public_posts view.
-- All queries now use the raw `posts` table directly, with anonymous author
-- masking handled in TypeScript. The view is unused and was flagged by
-- Supabase security advisor for SECURITY DEFINER.
DROP VIEW IF EXISTS public_posts;
