import { useEffect, useState } from 'react'
import { Stack, router, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Updates from 'expo-updates'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import { ThemeProvider, useTheme } from '../lib/theme'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { registerForPushNotifications, savePushToken } from '../lib/notifications'
import { setOnlineStatus } from '../lib/profiles'

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

  useEffect(() => {
    if (!session) return
    registerForPushNotifications().then(token => {
      if (token) savePushToken(token)
    })
    setOnlineStatus(true)
    return () => { setOnlineStatus(false) }
  }, [session?.user?.id])

  useEffect(() => {
    if (!mounted || !initialized) return
    const inAuth = segments[0] === '(auth)'
    if (!session && !inAuth) router.replace('/(auth)/welcome')
  }, [session, segments, mounted, initialized])

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

  useEffect(() => {
    hydrate()
    checkForUpdate()
  }, [])

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppStack />
      </ThemeProvider>
    </ErrorBoundary>
  )
}