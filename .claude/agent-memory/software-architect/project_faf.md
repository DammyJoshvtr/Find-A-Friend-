---
name: FAF Project Context
description: Existing stack, schema shape, conventions, and architecture decisions for the 9-segment expansion
type: project
---

Stack: React Native 0.81 / Expo ~54 / expo-router ~6 / TypeScript / Supabase (auth + postgres + storage + realtime) / Zustand / @tanstack/react-query / react-native-gesture-handler + reanimated / expo-haptics / expo-image-picker / expo-notifications

Existing tables (inferred from lib/ queries):
- profiles: id, email, full_name, bio, department, level, interests[], avatar_url, is_online, push_token
- posts: id, author_id, body, tags[], image_url, is_anonymous, likes_count, comments_count, created_at
- connections: id, requester_id, receiver_id, status (pending|accepted)
- conversations: id, name, is_group, created_at
- conversation_participants: conversation_id, user_id
- messages: id, conversation_id, sender_id, body, created_at
- events: id, title, venue, starts_at (used in map.tsx query)

Existing storage bucket: posts-media (public)

Color palette: bg #0d0d14, card #1c1c2e, accent #a78bfa (purple), green #34d399, blue #60a5fa, pink #f472b6, yellow #fbbf24, red #f87171

Navigation: expo-router file-based. Root stack -> (auth) group or (tabs) group. Tabs: Home, Discover, Events, Chat, More. Secondary screens (map, clubs, confessions, academic, deals, profile) are modal/stack screens accessed from More tab via router.push().

Key conventions:
- All screens use SafeAreaView with backgroundColor #0d0d14
- StyleSheet.create() inline styles (no Tailwind used in practice despite dependency)
- lib/ folder for Supabase query helpers
- store/ folder for Zustand stores
- Realtime subscriptions via supabase.channel() in useEffect

9-segment expansion designed 2026-05-04. See full architecture document in the assistant's output for that session.

Why: Segment architecture was designed to be implementation-ready for separate backend-engineer and frontend-engineer agents.
How to apply: Always respect existing color palette, navigation patterns, and lib/ convention when suggesting new code.
