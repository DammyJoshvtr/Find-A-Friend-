/**
 * ScreenLoader.tsx
 *
 * Full-screen loading overlay shown while async data is fetching.
 * Layers (bottom → top):
 *   1. Solid dark background (#0d0d14)
 *   2. NeuralBackground — animated node/connection canvas
 *   3. Centred logo circle with scan-line animation + pulsing glow ring
 *   4. "Loading…" / custom message text
 *
 * The scan-line, glow, and logo entrance animations mirror the patterns
 * already established in app/(auth)/welcome.tsx so the visual language
 * stays consistent across the app.
 *
 * Props:
 *   message – optional string, defaults to "Loading…"
 */

import React, { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  withSpring,
  Easing,
} from 'react-native-reanimated'
import { typography } from '../lib/typography'
import { useTheme } from '../lib/theme'
import NeuralBackground from './NeuralBackground'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ScreenLoaderProps {
  message?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ScreenLoader({ message = 'Loading...' }: ScreenLoaderProps) {
  const theme = useTheme()

  // --- Logo entrance ---
  const logoScale = useSharedValue(0.5)
  const logoOpacity = useSharedValue(0)

  // --- Pulsing glow ring behind logo ---
  const glowOpacity = useSharedValue(0.3)
  const glowScale = useSharedValue(0.9)

  // --- Scan line inside the logo circle ---
  // Range: -1 (above the circle) → 1 (below the circle).
  // Mapped to a `top` percentage in useAnimatedStyle exactly as welcome.tsx does.
  const scanLine = useSharedValue(-1)

  // --- Message fade in ---
  const msgOpacity = useSharedValue(0)
  const msgY = useSharedValue(10)

  // --- Dot pulse for the loading indicator dots ---
  const dot1 = useSharedValue(0.25)
  const dot2 = useSharedValue(0.25)
  const dot3 = useSharedValue(0.25)

  useEffect(() => {
    // Logo entrance
    logoScale.value = withSpring(1, { damping: 12, stiffness: 90 })
    logoOpacity.value = withTiming(1, { duration: 600 })

    // Glow ring breathe
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.2, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    )
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.88, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    )

    // Scan line — identical pattern to welcome.tsx
    scanLine.value = withDelay(
      300,
      withRepeat(withTiming(1, { duration: 2000, easing: Easing.linear }), -1, false),
    )

    // Message appears after logo settles
    msgOpacity.value = withDelay(450, withTiming(1, { duration: 500 }))
    msgY.value = withDelay(450, withSpring(0, { damping: 14 }))

    // Staggered dot pulse (sequential wave)
    const DOT_PERIOD = 480
    dot1.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(1, { duration: DOT_PERIOD, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.25, { duration: DOT_PERIOD, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    )
    dot2.value = withDelay(
      600 + DOT_PERIOD * 0.33,
      withRepeat(
        withSequence(
          withTiming(1, { duration: DOT_PERIOD, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.25, { duration: DOT_PERIOD, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    )
    dot3.value = withDelay(
      600 + DOT_PERIOD * 0.66,
      withRepeat(
        withSequence(
          withTiming(1, { duration: DOT_PERIOD, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.25, { duration: DOT_PERIOD, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    )
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // --- Animated styles ---

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }))

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }))

  // Mirrors welcome.tsx exactly: top percentage derived from the -1..1 range
  const scanStyle = useAnimatedStyle(() => ({
    top: `${scanLine.value * 100}%` as `${number}%`,
  }))

  const msgStyle = useAnimatedStyle(() => ({
    opacity: msgOpacity.value,
    transform: [{ translateY: msgY.value }],
  }))

  const dot1Style = useAnimatedStyle(() => ({ opacity: dot1.value }))
  const dot2Style = useAnimatedStyle(() => ({ opacity: dot2.value }))
  const dot3Style = useAnimatedStyle(() => ({ opacity: dot3.value }))

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={s.container}>
      {/* Layer 1: solid background */}
      <View style={[s.bg, { backgroundColor: theme.bg }]} />

      {/* Layer 2: neural network canvas */}
      <NeuralBackground intensity="light" />

      {/* Layer 3: centred content */}
      <View style={s.centreContent}>

        {/* Logo section */}
        <View style={s.logoOuter}>
          {/* Pulsing glow ring */}
          <Animated.View style={[s.glowRing, { backgroundColor: theme.accentGlow }, glowStyle]} />

          {/* Logo circle */}
          <Animated.View style={[s.logoCircle, { backgroundColor: theme.accentBg, borderColor: theme.accentBorder }, logoStyle]}>
            {/* Scan line sweeping top→bottom */}
            <Animated.View style={[s.scanLine, { backgroundColor: theme.accentGlow }, scanStyle]} />

            {/* FAF text */}
            <Text style={[s.logoText, { color: theme.accent }]} accessibilityLabel="FAF">FAF</Text>

            {/* Status indicator dot (green = alive) */}
            <View style={s.statusDot} />
          </Animated.View>
        </View>

        {/* Message + animated dots */}
        <Animated.View style={[s.messageRow, msgStyle]}>
          <Text style={[s.messageText, { color: theme.textMuted }]}>{message}</Text>
          <View style={s.dotsRow}>
            <Animated.View style={[s.dot, { backgroundColor: theme.accent }, dot1Style]} />
            <Animated.View style={[s.dot, { backgroundColor: theme.accent }, dot2Style]} />
            <Animated.View style={[s.dot, { backgroundColor: theme.accent }, dot3Style]} />
          </View>
        </Animated.View>

      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  container: {
    // Fill the entire screen — caller should render this at the root level
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
  },

  // Centre column
  centreContent: {
    alignItems: 'center',
    gap: 28,
  },

  // ── Logo ──────────────────────────────────────────────────────────────────

  logoOuter: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    // Clip the scan line inside the circle
    overflow: 'hidden',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1.5,
  },
  logoText: {
    fontSize: 30,
    fontFamily: typography.fontExtraBold,
    letterSpacing: 2,
  },
  statusDot: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },

  // ── Message row ───────────────────────────────────────────────────────────

  messageRow: {
    alignItems: 'center',
    gap: 10,
  },
  messageText: {
    fontSize: 14,
    fontFamily: typography.fontMedium,
    letterSpacing: 0.4,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
})
