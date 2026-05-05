---
name: FAF Project Architecture
description: Core architecture decisions, stack, and DB schema conventions for the FAF school social app
type: project
---

FAF is a React Native / Expo + TypeScript + Supabase school social app.

**Why:** A 9-segment expansion was designed by the software architect and implemented in one migration + 10 TypeScript lib files.

**Key architectural decisions:**
- All feed queries MUST use the `public_posts` VIEW (not `posts` table directly) — this masks `author_id` for anonymous posts at the DB layer.
- Anonymous post real identity is stored in `anonymous_post_audit` (RLS USING false — service_role only). A SECURITY DEFINER trigger `trg_anon_audit` populates it automatically on every anonymous post INSERT.
- Like toggle uses the `toggle_post_like` SECURITY DEFINER RPC (replaces deprecated `increment_likes` RPC). The old RPC was dropped in the migration.
- Denormalized counts (likes_count, comments_count, repost_count, follower_count, following_count, member_count, rsvp_count) are all maintained by triggers — never update them manually from client code.
- Academic resource files are stored in the PRIVATE `academic-resources` bucket. Clients access them via 1-hour signed URLs from `getResourceSignedUrl()`.
- The `follows` table is unidirectional (Twitter-style). The existing `connections` table remains for bidirectional DM access.
- Supabase project ID: `vcbtvhociaioeyhhsczh`

**How to apply:** When touching any feed query, always verify it uses `public_posts` view. When adding count columns, add a corresponding trigger. Never INSERT into `notifications` from client code — use Edge Functions or service_role.
