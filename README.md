# FAF — Campus Social Feed

A school social app built with Expo, React Native, TypeScript, and Supabase. Students can post to a campus feed, watch stories, discover events and clubs, find study partners, browse campus vendors, and post anonymously — all in one place.

---

## Features

Nine feature segments, each backed by its own `lib/` module and Supabase tables:

| Segment | What it does |
|---|---|
| **Feed** | Chronological campus posts with likes, comments, reposts, and hashtag threading |
| **Stories** | 24-hour ephemeral media (image/video) grouped by author, viewed in sequence |
| **Events** | Create and RSVP to campus events; filter by date, category, or club |
| **Map** | Static campus map image with overlay pins for buildings, events, and vendors |
| **Discover** | Search across users, posts, hashtags, and clubs; trending hashtag board |
| **Anonymous** | Confessions board — author identity masked at the DB view layer, audit trail in service-role-only table |
| **Clubs** | Join student clubs, read club feeds, post announcements (club admins only) |
| **Academic** | Enroll in courses, join study groups, share and download academic resources |
| **Vendors** | Browse approved campus vendors and their student deals; save deals for later |

Additional cross-cutting features: push notifications, follow/follower graph, real-time notification delivery via Supabase Realtime, and role-based access (`student` / `admin` / `vendor`).

---

## Tech Stack

- **Expo** ~54 with `expo-router` v6 (file-based navigation)
- **React Native** 0.81 + **React** 19
- **TypeScript** ~5.9
- **Supabase** (`@supabase/supabase-js` v2) — Postgres, Auth, Storage, Realtime, RLS
- **Zustand** v5 — client state (feed, stories, notifications, auth)
- **React Native StyleSheet** — styling via `StyleSheet.create` (no CSS-in-JS dependency)
- **AsyncStorage** (`@react-native-async-storage/async-storage`) — local storage for story viewed-IDs cache and persisted state
- Zustand stores handle all data fetching with manual loading state (no separate server-state library)
- **React Native Reanimated** v4 + **Gesture Handler** — animations and swipe interactions
- **expo-notifications** — push notification registration and foreground handling

---

## Setup

### Prerequisites

- Node.js 18+
- A Supabase project (free tier is fine)
- Expo CLI: `npm install -g expo-cli` (or use `npx expo`)

### 1. Clone and install

```bash
git clone <repo-url>
cd faf
npm install
```

### 2. Configure environment variables

The app currently reads Supabase credentials from `lib/supabase.ts`. Before committing to a team or CI environment, move these to environment variables:

Create a `.env` file at the project root (it is already gitignored):

```env
EXPO_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

Then update `lib/supabase.ts` to read from them:

```ts
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
```

> The `EXPO_PUBLIC_` prefix makes variables available in the React Native bundle. Never put your `service_role` key here.

### 3. Apply the database migration

Run the single migration file against your Supabase project:

**Option A — Supabase CLI**
```bash
npx supabase db push
```

**Option B — Supabase Dashboard SQL editor**

Open `supabase/migrations/20260504000000_social_feed_expansion.sql` and paste the contents into the Dashboard SQL editor, then run it. The migration is idempotent (`IF NOT EXISTS` / `OR REPLACE` guards throughout).

### 4. Create storage buckets

The migration documents required buckets but cannot create them on the hosted platform via SQL. Create these in the Supabase Dashboard under **Storage**:

| Bucket | Public? | Max size | Allowed MIME types |
|---|---|---|---|
| `stories` | Yes | 50 MB | `image/*`, `video/mp4` |
| `avatars` | Yes | 5 MB | `image/*` |
| `club-covers` | Yes | 10 MB | `image/*` |
| `event-covers` | Yes | 10 MB | `image/*` |
| `vendor-assets` | Yes | 10 MB | `image/*` |
| `campus-map` | Yes | 20 MB | `image/*` |
| `academic-resources` | **No** | 50 MB | PDF, Office, images |
| `posts-media` | Yes | — | `image/*` |

Upload your campus map image to the `campus-map` bucket as `campus.png`.

### 5. Run the app

```bash
npx expo start
```

Press `i` for iOS simulator, `a` for Android emulator, or scan the QR code with Expo Go.

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase `anon` (publishable) key |

---

## Folder Structure

```
faf/
├── app/                    # Expo Router screens (file = route)
│   ├── (auth)/             # Unauthenticated screens (login, verify)
│   ├── (tabs)/             # Bottom tab navigator
│   │   ├── index.tsx       # Home feed
│   │   ├── discover.tsx    # Search + trending
│   │   ├── events.tsx      # Events list + calendar
│   │   ├── chat.tsx        # Direct messages
│   │   ├── map.tsx         # Campus map
│   │   └── more.tsx        # Profile, clubs, academic, vendors
│   ├── post/               # Single post detail
│   ├── event/              # Single event detail
│   ├── club/               # Club detail + feed
│   ├── course/             # Course detail + resources + discussions
│   ├── profile/            # User profile
│   ├── study-group/        # Study group detail
│   ├── hashtag/            # Posts by hashtag
│   ├── vendor/             # Vendor detail
│   ├── anonymous.tsx       # Anonymous confessions board
│   ├── create-post.tsx     # Post composer
│   ├── create-story.tsx    # Story creator
│   ├── create-event.tsx    # Event creator
│   ├── notifications.tsx   # Notification inbox
│   └── search.tsx          # Global search
│
├── lib/                    # Supabase API helpers (one file per domain)
│   ├── supabase.ts         # Supabase client singleton
│   ├── feed.ts             # Posts, likes, comments, reposts, hashtags
│   ├── stories.ts          # Stories CRUD + view tracking
│   ├── events.ts           # Events CRUD + RSVP
│   ├── map.ts              # Map pins + campus map URL
│   ├── anonymous.ts        # Anonymous post create/fetch/audit
│   ├── clubs.ts            # Clubs, membership, announcements
│   ├── academic.ts         # Courses, study groups, resources, discussions
│   ├── vendors.ts          # Vendors, deals, saved deals
│   ├── follows.ts          # Follow / unfollow, follower lists
│   ├── notifications.ts    # Read / mark-read notifications
│   ├── profiles.ts         # Profile read/update, avatar upload
│   ├── posts.ts            # Post image upload helpers
│   ├── search.ts           # Cross-entity search
│   ├── connections.ts      # Match suggestions
│   └── matching.ts         # Matching algorithm helpers
│
├── store/                  # Zustand global stores
│   ├── authStore.ts        # Session + user, subscribes to auth state changes
│   ├── feedStore.ts        # Paginated feed, optimistic likes
│   ├── storiesStore.ts     # Story groups, viewer state, AsyncStorage viewed-IDs cache
│   ├── notificationsStore.ts # Notification list + unread badge count
│   └── themeStore.ts       # Color scheme preference
│
├── components/             # Shared UI components, grouped by domain
├── constants/              # Colors, layout constants
├── supabase/
│   └── migrations/         # SQL migration files
└── assets/                 # Fonts, images, icons
```

---

## Key Architectural Decisions

### Anonymous post privacy model

Anonymous posts are stored in the `posts` table with `is_anonymous = true` and a real `author_id`. A `SECURITY DEFINER` trigger (`trg_anon_audit`) fires on every such insert and writes `(post_id, real_author)` into `anonymous_post_audit`. That table has an RLS policy of `USING (false)`, blocking all client access — only `service_role` (admin Edge Functions) can read it.

Client queries always use the `public_posts` VIEW, which returns `NULL` for `author_id` when `is_anonymous = true`. The `lib/anonymous.ts` helper additionally strips `author_id` from the returned object as a belt-and-suspenders measure.

**Result:** author identity is never in the client bundle, even for the post's own author.

### Static map approach

The campus map is a single image stored in the `campus-map` storage bucket (`campus.png`). Pin positions are stored as normalized floats `0.0–1.0` in `map_locations.pin_x` / `pin_y` (fraction of image dimensions). The map component multiplies these by the rendered image size to get absolute pixel positions.

This avoids a native maps SDK dependency and works reliably offline. The trade-off is that it requires an admin to manually calibrate pin coordinates when the image changes.

### RLS policies

Every table has RLS enabled. The general pattern:

- **Read:** open to `authenticated` (or `true`) for non-sensitive data, filtered by ownership or status for sensitive data
- **Write:** `auth.uid()` must match the row's owner column
- **Admin operations** (club creation, course seeding, vendor approval): gated by `profiles.role = 'admin'` or require `service_role` via an Edge Function
- **Counts** (likes, RSVPs, members, reposts, story views): maintained atomically by DB triggers, not client-side increment calls

### State management split

- **Zustand** owns UI-critical state that must survive screen transitions: the feed list (with optimistic like state), story viewer position, notification badge count, and auth session. Zustand stores also handle all data fetching directly, using manual `loading` / `error` flags instead of a separate server-state library.

### Cursor-based pagination

Feed and most list queries use cursor-based pagination via `created_at` timestamps rather than offset-based `LIMIT/OFFSET`. This avoids duplicate/skipped items when new posts arrive while the user scrolls.

---

## Contributing

1. Fork the repo and create a branch: `git checkout -b feat/my-feature`
2. Install dependencies: `npm install`
3. Run `npx expo start` and test on a simulator/device
4. Keep `lib/` functions pure — no navigation calls, no React hooks, only Supabase client usage
5. All new tables need RLS enabled and policies defined before merging
6. Open a pull request against `main`

---

## License

Private — all rights reserved.
