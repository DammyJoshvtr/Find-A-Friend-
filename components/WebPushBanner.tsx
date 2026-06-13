/**
 * WebPushBanner.tsx
 *
 * Shows a dismissible banner on web/PWA when the user hasn't yet granted
 * push-notification permission. Tapping "Enable" triggers the browser
 * permission dialog FROM a user gesture — which iOS Safari requires.
 *
 * Usage: Render <WebPushBanner userId={session.user.id} /> inside AppStack.
 */
import React, { useEffect, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View, Animated } from 'react-native'
import { subscribeToWebPush } from '../lib/notifications'

interface Props {
  userId: string
}

export function WebPushBanner({ userId }: Props) {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const opacity = React.useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (!('Notification' in window)) return

    // Only show banner when permission has not been decided yet
    if (Notification.permission === 'default') {
      setVisible(true)
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start()
    }
  }, [])

  if (!visible || dismissed) return null

  const handleEnable = async () => {
    // This function is called from a tap — satisfies iOS gesture requirement
    setDismissed(true)
    await subscribeToWebPush(userId)
  }

  const handleDismiss = () => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setDismissed(true))
  }

  return (
    <Animated.View style={[s.banner, { opacity }]}>
      <View style={s.content}>
        <Text style={s.bell}>🔔</Text>
        <View style={s.textWrap}>
          <Text style={s.title}>Stay in the loop</Text>
          <Text style={s.body}>Enable notifications to get instant updates</Text>
        </View>
      </View>
      <View style={s.actions}>
        <Pressable style={s.btnEnable} onPress={handleEnable}>
          <Text style={s.btnEnableText}>Enable</Text>
        </Pressable>
        <Pressable style={s.btnDismiss} onPress={handleDismiss}>
          <Text style={s.btnDismissText}>Not now</Text>
        </Pressable>
      </View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  banner: {
    position: 'absolute',
    bottom: 90,
    left: 12,
    right: 12,
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.3)',
    padding: 14,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  bell: { fontSize: 24 },
  textWrap: { flex: 1 },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f0f0ff',
    marginBottom: 2,
  },
  body: {
    fontSize: 12,
    color: 'rgba(240,240,255,0.5)',
    lineHeight: 17,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  btnEnable: {
    flex: 1,
    backgroundColor: '#a78bfa',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnEnableText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  btnDismiss: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  btnDismissText: {
    fontSize: 13,
    color: 'rgba(240,240,255,0.4)',
  },
})
