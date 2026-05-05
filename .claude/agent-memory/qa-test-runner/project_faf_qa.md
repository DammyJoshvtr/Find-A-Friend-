---
name: FAF Project QA Findings
description: QA pass findings, bug patterns, and fixes applied to the FAF React Native/Expo app
type: project
---

Two QA passes completed on this React Native / Expo + TypeScript campus social app.

**Framework stack:** Expo Router (file-based), React Native, TypeScript, Supabase, Zustand for state.

**Known bug-prone patterns found:**

1. `router.push(null as any)` crash: occurs when a navigation route is `null` but called unconditionally. Always guard with `if (route)` or use a sentinel/special-case check.

2. Expo Router `<Stack>` with `screenOptions={{ headerShown: false }}` suppresses headers globally — explicit `Stack.Screen` entries are still needed for the screen to be properly registered in the navigator tree (especially for new dynamic routes like `profile/[id]`, `post/[id]`, `club/[id]`, etc.).

3. Flat file vs directory conflict: `app/profile.tsx` (edit-own-profile) and `app/profile/[id].tsx` (view-any-profile) coexist. Expo Router handles them as `/profile` and `/profile/[id]` — different routes, no conflict. But `more.tsx` originally navigated to `/profile` (flat) for "My profile" — should go to `/profile/${user.id}` (dynamic).

4. Optimistic like toggle rollback in feedStore: rollback reads the already-flipped `state.posts` count. Adding 1 to a decremented count and subtracting 1 from an incremented count correctly restores the original — logic is sound.

5. Anonymous post rendering in PostCard.tsx: correctly shows "Anonymous" + ghost icon (`eye-off-outline`), never exposes author name/avatar when `is_anonymous=true`. `handleAuthorPress` is disabled when `isAnon` is true.

**Files fixed in QA pass 2:**
- `app/_layout.tsx`: Added explicit Stack.Screen registrations for all 20+ routes
- `app/(tabs)/more.tsx`: Fixed null-route crash for "My profile" feature card; added type annotation for features array; added `user?.id` guard before push

**Files verified correct (no changes needed) in QA pass 2:**
- `app/profile/[id].tsx`: `user` variable properly used, navigation correct
- `components/feed/PostCard.tsx`: anonymous rendering correct
- `store/feedStore.ts`: optimistic like rollback and reconciliation correct

**Why:** Project is an active React Native campus app. Fixes needed for correct navigation on newly added screens and to prevent runtime crashes when `user` is not yet loaded.

**How to apply:** When adding new screens/routes, always register them in `_layout.tsx` Stack and ensure no navigation call uses a potentially-null route string directly.
