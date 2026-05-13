import React, { useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withRepeat, withSequence, withSpring, Easing,
} from 'react-native-reanimated'
import { typography } from '../../lib/typography'

const { width, height } = Dimensions.get('window')

const FEATURES = [
  { icon: '🎓', text: 'Verified campus students only' },
  { icon: '🧠', text: 'Smart interest-based matching' },
  { icon: '📅', text: 'Live events & campus map' },
  { icon: '💬', text: 'Real-time encrypted messaging' },
  { icon: '🏛️', text: 'Clubs, societies & study groups' },
  { icon: '🎮', text: 'Social games & challenges' },
]

function Orb({ x, y, size, color, delay }: { x: number; y: number; size: number; color: string; delay: number }) {
  const opacity = useSharedValue(0)
  const scale = useSharedValue(0.8)
  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.3, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      ), -1, true
    ))
    scale.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1.25, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.75, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      ), -1, true
    ))
  }, [])
  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }))
  return (
    <Animated.View style={[{
      position: 'absolute', left: x - size / 2, top: y - size / 2,
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color,
    }, style]} />
  )
}

function FeatureRow({ icon, text, delay }: { icon: string; text: string; delay: number }) {
  const opacity = useSharedValue(0)
  const tx = useSharedValue(-24)
  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 450 }))
    tx.value = withDelay(delay, withSpring(0, { damping: 16, stiffness: 120 }))
  }, [])
  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateX: tx.value }] }))
  return (
    <Animated.View style={[s.featureRow, style]}>
      <View style={s.featureIconWrap}>
        <Text style={s.featureIcon}>{icon}</Text>
      </View>
      <Text style={s.featureText}>{text}</Text>
    </Animated.View>
  )
}

export default function WelcomeScreen() {
  const logoScale = useSharedValue(0.4)
  const logoOpacity = useSharedValue(0)
  const glowOp = useSharedValue(0.4)
  const glowScale = useSharedValue(1)
  const titleOp = useSharedValue(0)
  const titleY = useSharedValue(18)
  const btnOp = useSharedValue(0)
  const btnY = useSharedValue(20)
  const scanLine = useSharedValue(-1)

  useEffect(() => {
    logoScale.value = withSpring(1, { damping: 12, stiffness: 90 })
    logoOpacity.value = withTiming(1, { duration: 700 })

    glowOp.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.25, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ), -1, true
    )
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.35, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.85, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      ), -1, true
    )

    titleOp.value = withDelay(350, withTiming(1, { duration: 600 }))
    titleY.value = withDelay(350, withSpring(0, { damping: 14 }))

    btnOp.value = withDelay(1100, withTiming(1, { duration: 600 }))
    btnY.value = withDelay(1100, withSpring(0, { damping: 14 }))

    scanLine.value = withDelay(400, withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.linear }), -1, false
    ))
  }, [])

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }))
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOp.value,
    transform: [{ scale: glowScale.value }],
  }))
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOp.value,
    transform: [{ translateY: titleY.value }],
  }))
  const btnStyle = useAnimatedStyle(() => ({
    opacity: btnOp.value,
    transform: [{ translateY: btnY.value }],
  }))
  const scanStyle = useAnimatedStyle(() => ({
    top: `${scanLine.value * 100}%`,
  }))

  return (
    <View style={s.container}>
      {/* Background */}
      <View style={s.bg} />

      {/* Ambient orbs */}
      <Orb x={width * 0.15} y={height * 0.18} size={220} color="rgba(167,139,250,0.11)" delay={0} />
      <Orb x={width * 0.88} y={height * 0.32} size={160} color="rgba(96,165,250,0.09)" delay={700} />
      <Orb x={width * 0.4}  y={height * 0.65} size={240} color="rgba(244,114,182,0.07)" delay={1400} />
      <Orb x={width * 0.8}  y={height * 0.75} size={130} color="rgba(52,211,153,0.08)" delay={400} />

      {/* Grid lines overlay */}
      <View style={s.grid} pointerEvents="none">
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={i} style={[s.gridLine, { top: `${i * 14}%` as any }]} />
        ))}
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.content}>

          {/* Logo section */}
          <View style={s.logoSection}>
            <View style={s.logoOuter}>
              {/* Pulsing glow behind logo */}
              <Animated.View style={[s.glowRing, glowStyle]} />
              <Animated.View style={[s.logoWrap, logoStyle]}>
                {/* Scan line inside logo */}
                <Animated.View style={[s.scanLine, scanStyle]} />
                <Text style={s.logoText}>FAF</Text>
                <View style={s.logoDot} />
              </Animated.View>
            </View>

            <Animated.View style={[{ alignItems: 'center', marginTop: 20 }, titleStyle]}>
              <Text style={s.tagline}>Find A Friend</Text>
              <View style={s.taglineLine} />
              <Text style={s.sub}>Your campus social universe</Text>
            </Animated.View>
          </View>

          {/* Feature card */}
          <View style={s.featureCard}>
            <View style={s.featureCardHeader}>
              <View style={s.featureCardDot} />
              <Text style={s.featureCardLabel}>PLATFORM FEATURES</Text>
              <View style={[s.featureCardDot, { backgroundColor: '#60a5fa' }]} />
            </View>
            {FEATURES.map((f, i) => (
              <FeatureRow key={i} icon={f.icon} text={f.text} delay={600 + i * 90} />
            ))}
          </View>

          {/* CTA */}
          <Animated.View style={[s.actions, btnStyle]}>
            <TouchableOpacity
              style={s.btnPrimary}
              activeOpacity={0.85}
              onPress={() => router.push('/(auth)/verify')}>
              <View style={s.btnGlow} />
              <Text style={s.btnText}>Get started →</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.btnSecondary}
              activeOpacity={0.8}
              onPress={() => router.push('/(auth)/verify')}>
              <Text style={s.btnSecondaryText}>Sign in to my account</Text>
            </TouchableOpacity>
            <Text style={s.disclaimer}>
              University email required · Students only
            </Text>
          </Animated.View>

        </View>
      </SafeAreaView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#07070f' },

  grid: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  gridLine: {
    position: 'absolute', left: 0, right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(167,139,250,0.06)',
  },

  content: {
    flex: 1, paddingHorizontal: 22,
    justifyContent: 'space-between', paddingVertical: 16,
  },

  logoSection: { alignItems: 'center', paddingTop: 24 },
  logoOuter: { alignItems: 'center', justifyContent: 'center', width: 140, height: 140 },
  glowRing: {
    position: 'absolute',
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(167,139,250,0.18)',
  },
  logoWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(167,139,250,0.08)',
    borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.5)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  scanLine: {
    position: 'absolute', left: 0, right: 0,
    height: 1.5, backgroundColor: 'rgba(167,139,250,0.35)',
  },
  logoText: {
    fontSize: 30, fontFamily: typography.fontExtraBold,
    color: '#c4b5fd', letterSpacing: 2,
  },
  logoDot: {
    position: 'absolute', bottom: 14, right: 14,
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ade80',
  },

  tagline: {
    fontSize: 28, fontFamily: typography.fontBold,
    color: '#f0e8ff', letterSpacing: 0.3,
  },
  taglineLine: {
    width: 40, height: 2, borderRadius: 1,
    backgroundColor: '#a78bfa', marginVertical: 8,
  },
  sub: {
    fontSize: 13, fontFamily: typography.fontRegular,
    color: 'rgba(200,180,255,0.45)',
  },

  featureCard: {
    borderRadius: 20,
    backgroundColor: 'rgba(167,139,250,0.05)',
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.15)',
    padding: 18, gap: 12,
  },
  featureCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4,
  },
  featureCardDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#a78bfa',
  },
  featureCardLabel: {
    flex: 1, fontSize: 9, fontFamily: typography.fontSemiBold,
    color: 'rgba(167,139,250,0.5)', letterSpacing: 2,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(167,139,250,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  featureIcon: { fontSize: 16 },
  featureText: {
    fontSize: 13, fontFamily: typography.fontMedium,
    color: 'rgba(210,190,255,0.75)',
  },

  actions: { gap: 10, paddingBottom: 8 },
  btnPrimary: {
    borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#a78bfa',
    overflow: 'hidden',
    shadowColor: '#a78bfa', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 12,
  },
  btnGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  btnText: {
    fontSize: 15, fontFamily: typography.fontBold,
    color: '#fff', letterSpacing: 0.3,
  },
  btnSecondary: {
    borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.35)',
    backgroundColor: 'rgba(167,139,250,0.07)',
  },
  btnSecondaryText: {
    fontSize: 14, fontFamily: typography.fontSemiBold,
    color: '#c4b5fd', letterSpacing: 0.2,
  },
  disclaimer: {
    fontSize: 11, fontFamily: typography.fontRegular,
    color: 'rgba(200,180,255,0.3)', textAlign: 'center',
  },
})
