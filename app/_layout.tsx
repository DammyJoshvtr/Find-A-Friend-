import { useEffect, useState } from 'react'
import { Stack, router, useSegments } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { ErrorBoundary } from '../components/ErrorBoundary'

export default function RootLayout() {
  const { session, setSession } = useAuthStore()
  const segments = useSegments()
  const [mounted, setMounted] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setInitialized(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!mounted || !initialized) return
    const inAuth = segments[0] === '(auth)'
    if (!session && !inAuth) {
      router.replace('/(auth)/welcome')
    }
  }, [session, segments, mounted, initialized])

  return (
    <ErrorBoundary>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Tab navigator */}
        <Stack.Screen name="(tabs)" />
        {/* Auth flow */}
        <Stack.Screen name="(auth)" />
        {/* Posts */}
        <Stack.Screen name="post/[id]" />
        <Stack.Screen name="create-post" />
        <Stack.Screen name="hashtag/[tag]" />
        {/* Stories */}
        <Stack.Screen name="create-story" />
        {/* Events */}
        <Stack.Screen name="event/[id]" />
        <Stack.Screen name="create-event" />
        {/* Anonymous / confessions */}
        <Stack.Screen name="anonymous" />
        <Stack.Screen name="create-anonymous-post" />
        {/* Clubs */}
        <Stack.Screen name="clubs" />
        <Stack.Screen name="club/[id]" />
        {/* Academic */}
        <Stack.Screen name="academic" />
        <Stack.Screen name="study-group/[id]" />
        <Stack.Screen name="course/[id]" />
        {/* Vendors / deals */}
        <Stack.Screen name="vendors" />
        <Stack.Screen name="vendor/[id]" />
        <Stack.Screen name="vendor-apply" />
        {/* Social */}
        <Stack.Screen name="notifications" />
        <Stack.Screen name="profile/[id]" />
        <Stack.Screen name="search" />
        {/* Map */}
        <Stack.Screen name="map" />
      </Stack>
    </ErrorBoundary>
  )
}