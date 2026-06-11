-- Migration: Remove non-admin badges and drop default verified badge trigger
-- Timestamp: 20260611080000

-- 1. Drop trigger and function for default verified badge
DROP TRIGGER IF EXISTS trg_set_default_badge_type ON public.profiles;
DROP FUNCTION IF EXISTS public.set_default_badge_type();

-- 2. Clear badge_type and badge_color for all profiles except admin
UPDATE public.profiles
SET badge_type = NULL,
    badge_color = NULL
WHERE role IS DISTINCT FROM 'admin';
