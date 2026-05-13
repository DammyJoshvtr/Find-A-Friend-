import { useEffect, useState, useRef } from 'react'
import { AppState } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Stack, router, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Updates from 'expo-updates'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import { useNotificationsStore } from '../store/notificationsStore'
import { usePresenceStore } from '../store/presenceStore'
import { ThemeProvider, useTheme } from '../lib/theme'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { registerForPushNotifications, savePushToken } from '../lib/notifications'
import * as Notifications from 'expo-notifications'
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans'
import Toast from 'react-native-toast-message'
import * as SplashScreen from 'expo-splash-screen'

SplashScreen.preventAutoHideAsync().catch(() => {})

function AppStack() {
  const { session, setSession } = useAuthStore()
  const segments = useSegments()
  const [mounted, setMounted] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const theme = useTheme()

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setInitialized(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    )
    return () => subscription.unsubscribe()
  }, [])

  const { addNotification, loadUnreadCount } = useNotificationsStore()
  const { setOnlineUsers } = usePresenceStore()
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!session) return

    // Push notification registration
    registerForPushNotifications().then(token => {
      if (token) savePushToken(token)
    })

    // Load initial unread count
    loadUnreadCount()

    // ── Presence channel ────────────────────────────────────────────────────
    // Supabase Presence automatically removes users when they disconnect
    // (app killed, network loss, crash) — far more reliable than writing to DB.
    const presenceChannel = supabase.channel('online-users', {
      config: { presence: { key: session.user.id } },
    })

    const syncOnlineUsers = () => {
      const state = presenceChannel.presenceState()
      setOnlineUsers(Object.keys(state))
    }

    presenceChannel
      .on('presence', { event: 'sync' }, syncOnlineUsers)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: session.user.id, online_at: Date.now() })
        }
      })

    presenceChannelRef.current = presenceChannel

    // ── AppState: re-track on foreground, untrack on background ────────────
    const appStateSub = AppState.addEventListener('change', async (nextState) => {
      if (!presenceChannelRef.current) return
      if (nextState === 'active') {
        await presenceChannelRef.current.track({ user_id: session.user.id, online_at: Date.now() })
      } else {
        await presenceChannelRef.current.untrack()
      }
    })

    // ── In-app notification subscription ───────────────────────────────────
    const notifChannel = supabase
      .channel('user-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${session.user.id}`,
      }, (payload: any) => {
        addNotification(payload.new)
      })
      .subscribe()

    return () => {
      presenceChannelRef.current?.untrack()
      supabase.removeChannel(presenceChannel)
      supabase.removeChannel(notifChannel)
      appStateSub.remove()
      presenceChannelRef.current = null
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (!mounted || !initialized) return
    const inAuth = segments[0] === '(auth)'
    if (!session && !inAuth) router.replace('/(auth)/welcome')
  }, [session, segments, mounted, initialized])

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, string> | undefined
      if (data?.route) router.push(data.route as any)
      else if (data?.actorId) router.push(`/profile/${data.actorId}` as any)
      else router.push('/notifications' as any)
    })
    return () => sub.remove()
  }, [])

  return (
    <>
      <StatusBar style={theme.statusBar} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="post/[id]" />
        <Stack.Screen name="create-post" />
        <Stack.Screen name="hashtag/[tag]" />
        <Stack.Screen name="create-story" />
        <Stack.Screen name="event/[id]" />
        <Stack.Screen name="create-event" />
        <Stack.Screen name="anonymous" />
        <Stack.Screen name="create-anonymous-post" />
        <Stack.Screen name="clubs" />
        <Stack.Screen name="club/[id]" />
        <Stack.Screen name="academic" />
        <Stack.Screen name="study-group/[id]" />
        <Stack.Screen name="course/[id]" />
        <Stack.Screen name="vendors" />
        <Stack.Screen name="vendor/[id]" />
        <Stack.Screen name="vendor-apply" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="profile/[id]" />
        <Stack.Screen name="search" />
        <Stack.Screen name="map" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="bookmarks" />
        <Stack.Screen name="appearance" />
        <Stack.Screen name="privacy-settings" />
        <Stack.Screen name="help" />
        <Stack.Screen name="verification" />
        <Stack.Screen name="followers/[id]" />
        <Stack.Screen name="following/[id]" />
        <Stack.Screen name="deals" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="games" />
        <Stack.Screen name="game-lobby/[gameType]" />
        <Stack.Screen name="leaderboard/[gameType]" />
        <Stack.Screen name="play/waiting" />
        <Stack.Screen name="discover-likes" />
        <Stack.Screen name="club-room/[id]" />
        <Stack.Screen name="study-room/[id]" />
        <Stack.Screen name="feedback" />
      </Stack>
    </>
  )
}

async function checkForUpdate() {
  try {
    const result = await Updates.checkForUpdateAsync()
    if (result.isAvailable) {
      await Updates.fetchUpdateAsync()
      await Updates.reloadAsync()
    }
  } catch {}
}

export default function RootLayout() {
  const { hydrate } = useThemeStore()
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  })

  useEffect(() => {
    hydrate()
    checkForUpdate()
  }, [])

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <ThemeProvider>
          <AppStack />
          <Toast />
        </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  )
}