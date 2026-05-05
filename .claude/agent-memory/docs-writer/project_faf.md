---
name: FAF project context
description: Core facts about the FAF campus social app — stack, structure, and doc conventions established in first session
type: project
---

FAF is a school social feed app (Expo 54 / React Native 0.81 / TypeScript / Supabase). Nine feature segments: Feed, Stories, Events, Map, Discover, Anonymous, Clubs, Academic, Vendors.

**Why:** No README existed before first session. Documentation written from scratch based on code inspection.

**How to apply:** Use these facts as baseline context for all future doc work on this project. Verify against current code before citing specifics.

Key architectural facts confirmed in code:
- All client feed queries use `public_posts` VIEW (not `posts` table directly) — anonymous author masking
- Map pins stored as normalized floats 0.0–1.0 in `map_locations.pin_x/pin_y`
- Anonymous post audit in `anonymous_post_audit` table, RLS `USING (false)`, service_role only
- Single migration file: `supabase/migrations/20260504000000_social_feed_expansion.sql`
- Supabase credentials currently hardcoded in `lib/supabase.ts` (not env vars yet)
- Zustand stores: authStore, feedStore, storiesStore, notificationsStore, themeStore
- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are the env var names to use
