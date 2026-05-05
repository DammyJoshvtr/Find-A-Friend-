# Database Migrations

## `20260504000000_social_feed_expansion.sql`

Single migration that provisions the entire FAF social feed schema on top of a Supabase project that already has `profiles`, `posts`, `messages`, and `events` base tables.

### What it creates

| Section | Contents |
|---|---|
| **Table modifications** | Extends `profiles`, `posts`, `messages`, and `events` with new columns for roles, follow counts, post types, repost links, club/study-group foreign keys, RSVP data, and disappearing messages |
| **New tables** | `follows`, `post_likes`, `post_comments`, `reposts`, `hashtags`, `post_hashtags`, `trending_hashtags`, `stories`, `story_views`, `event_rsvps`, `map_locations`, `clubs`, `club_members`, `club_announcements`, `courses`, `course_enrollments`, `study_groups`, `study_group_members`, `academic_resources`, `course_discussions`, `vendors`, `vendor_deals`, `saved_deals`, `notifications`, `anonymous_post_audit` |
| **DB functions + triggers** | Atomic counters for follows, club members, RSVPs, post likes/comments/reposts, story views, and study group members. Anonymous post audit trigger. `toggle_post_like` RPC. `increment_resource_download` RPC. `delete_expired_stories` cleanup function. `refresh_trending_hashtags` function |
| **Views** | `public_posts` — masks `author_id` as `NULL` for anonymous posts; all client feed queries use this view |
| **RLS policies** | Row-level security enabled on every table. Follows the pattern: public read for non-sensitive data, owner-only write, admin-role gate for privileged operations, full block on `anonymous_post_audit` |
| **Storage** | Comments document 8 required storage buckets (must be created in the Dashboard — SQL cannot create hosted buckets). `academic-resources` is private; all others are public |

### How to apply

**Supabase CLI (recommended)**

```bash
npx supabase db push
```

**Supabase Dashboard**

1. Open your project in [supabase.com](https://supabase.com)
2. Go to **SQL Editor**
3. Paste the full contents of `20260504000000_social_feed_expansion.sql`
4. Click **Run**

The migration is safe to run more than once. All `CREATE TABLE`, `CREATE FUNCTION`, `CREATE TRIGGER`, and `ALTER TABLE ADD COLUMN` statements use `IF NOT EXISTS` or `OR REPLACE` guards. Foreign key additions are wrapped in `DO $$ ... $$` blocks that check `information_schema.table_constraints` before altering.

### After applying

- Create the 8 storage buckets listed in the migration comments and in the root `README.md`
- Upload `campus.png` to the `campus-map` bucket
- Seed at least one `courses` row via the Dashboard (course seeding requires `role = 'admin'` or service_role)
- Optionally run `SELECT refresh_trending_hashtags();` to initialize the trending table
