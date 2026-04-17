import { useEffect, useState } from 'react'
import { Stack, router, useSegments } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

export default function RootLayout() {
  const { session, setSession } = useAuthStore()
  const segments = useSegments()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!mounted) return
    if (session === undefined) return

    const inAuth = segments[0] === '(auth)'
    const inTabs = segments[0] === '(tabs)'

    if (!session && !inAuth) {
      router.replace('/(auth)/welcome')
    } else if (session && !inTabs) {
      router.replace('/(tabs)')
    }
  }, [session, segments, mounted])

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
    </Stack>
  )
}