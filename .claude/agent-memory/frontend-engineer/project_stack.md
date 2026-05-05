---
name: Project Stack
description: FAF app tech stack — Expo 54, RN 0.81, TypeScript, Supabase, Zustand, expo-router v6
type: project
---

Expo ~54.0.34, React Native 0.81.5, TypeScript ~5.9.2, expo-router ~6.0.23.
Supabase @supabase/supabase-js ^2.49, zustand ^5, react-native-mmkv ^4.
@expo/vector-icons ^15 (Ionicons used everywhere), expo-image-picker, expo-haptics.
react-native-gesture-handler ~2.28, react-native-reanimated ~4.1.
Color palette: bg=#0d0d14, card=#1c1c2e, accent=#a78bfa, text=#f0f0ff, muted=rgba(240,240,255,0.4).
No expo-image installed — use React Native Image. No expo-av installed — skip video playback.
All tabs in app/(tabs)/. Auth in app/(auth)/. Stores in store/. Lib in lib/.

**Why:** Needed to build entire frontend from scratch in one pass.
**How to apply:** Match these versions/patterns exactly in all new code.
