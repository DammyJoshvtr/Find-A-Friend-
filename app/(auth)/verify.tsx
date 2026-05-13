import React, { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  Dimensions,
} from 'react-native'
import Toast from 'react-native-toast-message'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withRepeat, withSequence, withSpring, Easing,
} from 'react-native-reanimated'
import { typography } from '../../lib/typography'

const { width } = Dimensions.get('window')

type Mode = 'signup' | 'signin'

const UNIVERSITY_DOMAINS = [
  'unilag.edu.ng', 'ui.edu.ng', 'oau.edu.ng', 'unn.edu.ng',
  'abu.edu.ng', 'uniben.edu.ng', 'lasu.edu.ng', 'yabatech.edu.ng',
  'edu.ng', 'ac.uk', 'edu', 'ac.za',
]

function isUniversityEmail(email: string) {
  return UNIVERSITY_DOMAINS.some(d => email.toLowerCase().endsWith(d))
}

function AnimatedInput({
  label, placeholder, value, onChangeText, secureTextEntry, keyboardType, autoCapitalize,
}: {
  label: string
  placeholder: string
  value: string
  onChangeText: (v: string) => void
  secureTextEntry?: boolean
  keyboardType?: any
  autoCapitalize?: any
}) {
  const [focused, setFocused] = useState(false)
  const borderOp = useSharedValue(0)
  const labelOp = useSharedValue(0.45)

  useEffect(() => {
    borderOp.value = withTiming(focused ? 1 : 0, { duration: 220 })
    labelOp.value = withTiming(focused ? 0.9 : 0.45, { duration: 220 })
  }, [focused])

  const borderStyle = useAnimatedStyle(() => ({ opacity: borderOp.value }))
  const labelStyle = useAnimatedStyle(() => ({ opacity: labelOp.value }))

  return (
    <View style={iv.wrap}>
      <Animated.Text style={[iv.label, labelStyle]}>{label}</Animated.Text>
      <View style={iv.inputOuter}>
        <TextInput
          style={iv.input}
          placeholder={placeholder}
          placeholderTextColor="rgba(167,139,250,0.25)"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? 'none'}
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <Animated.View style={[iv.focusLine, borderStyle]} />
      </View>
    </View>
  )
}

const iv = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: {
    fontSize: 11, fontFamily: typography.fontSemiBold,
    color: '#c4b5fd', letterSpacing: 1.2, marginBottom: 8,
    textTransform: 'uppercase',
  },
  inputOuter: {
    borderRadius: 14, overflow: 'hidden',
    backgroundColor: 'rgba(167,139,250,0.06)',
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.2)',
  },
  input: {
    paddingHorizontal: 18, paddingVertical: 15,
    fontSize: 14, fontFamily: typography.fontRegular,
    color: '#f0e8ff',
  },
  focusLine: {
    position: 'absolute', bottom: 0, left: 12, right: 12,
    height: 1.5, borderRadius: 1, backgroundColor: '#a78bfa',
  },
})

function Orb({ x, y, size, color, delay }: { x: number; y: number; size: number; color: string; delay: number }) {
  const opacity = useSharedValue(0)
  const scale = useSharedValue(0.8)
  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.2, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      ), -1, true
    ))
    scale.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1.3, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.7, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
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

export default function VerifyScreen() {
  const insets = useSafeAreaInsets()
  const [mode, setMode] = useState<Mode>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // Entry animations
  const cardOp = useSharedValue(0)
  const cardY = useSharedValue(30)
  const tabSlide = useSharedValue(0)

  useEffect(() => {
    cardOp.value = withDelay(200, withTiming(1, { duration: 500 }))
    cardY.value = withDelay(200, withSpring(0, { damping: 16, stiffness: 100 }))
  }, [])

  useEffect(() => {
    tabSlide.value = withSpring(mode === 'signup' ? 0 : 1, { damping: 18, stiffness: 140 })
  }, [mode])

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOp.value,
    transform: [{ translateY: cardY.value }],
  }))

  const tabIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabSlide.value * ((width - 48) / 2) }],
  }))

  const handleSubmit = async () => {
    const trimmedEmail = email.toLowerCase().trim()

    if (!trimmedEmail || !password) {
      Toast.show({ type: 'error', text1: 'Missing fields', text2: 'Please fill in all fields' })
      return
    }
    if (!isUniversityEmail(trimmedEmail)) {
      Toast.show({ type: 'error', text1: 'University email required', text2: 'Use your official university email (e.g. .edu.ng)' })
      return
    }
    if (password.length < 6) {
      Toast.show({ type: 'error', text1: 'Weak password', text2: 'Password must be at least 6 characters' })
      return
    }
    if (mode === 'signup' && password !== confirmPassword) {
      Toast.show({ type: 'error', text1: 'Passwords do not match', text2: 'Please check your passwords' })
      return
    }

    setLoading(true)

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { data: { email: trimmedEmail } },
      })
      if (error) {
        setLoading(false)
        if (error.message.toLowerCase().includes('already registered')) {
          Toast.show({ type: 'info', text1: 'Account exists', text2: 'Switching to sign in.' })
          setMode('signin')
        } else {
          Toast.show({ type: 'error', text1: 'Sign up failed', text2: error.message })
        }
        return
      }
      if (data.session) {
        setLoading(false)
        router.replace('/(auth)/onboarding')
      } else {
        const { data: sd } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password })
        setLoading(false)
        if (sd?.session) {
          router.replace('/(auth)/onboarding')
        } else {
          Toast.show({ type: 'success', text1: 'Check your email', text2: `Confirmation sent to ${trimmedEmail}` })
          setMode('signin')
        }
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password })
      setLoading(false)
      if (error) {
        if (error.message.toLowerCase().includes('not confirmed')) {
          Toast.show({ type: 'info', text1: 'Email not confirmed', text2: 'Check your inbox for a confirmation link.' })
        } else {
          Toast.show({ type: 'error', text1: 'Sign in failed', text2: 'Wrong email or password.' })
        }
        return
      }
      if (data.session) {
        const { data: profile } = await supabase
          .from('profiles').select('id').eq('id', data.session.user.id).maybeSingle()
        router.replace(profile ? '/(tabs)' : '/(auth)/onboarding')
      }
    }
  }

  return (
    <View style={s.root}>
      {/* Dark background */}
      <View style={s.bg} />

      {/* Grid */}
      <View style={s.grid} pointerEvents="none">
        {Array.from({ length: 10 }).map((_, i) => (
          <View key={i} style={[s.gridLine, { top: `${i * 11}%` as any }]} />
        ))}
      </View>

      {/* Ambient orbs */}
      <Orb x={width * 0.1}  y={120} size={200} color="rgba(167,139,250,0.09)" delay={0} />
      <Orb x={width * 0.9}  y={300} size={160} color="rgba(96,165,250,0.07)"  delay={800} />
      <Orb x={width * 0.5}  y={600} size={220} color="rgba(244,114,182,0.06)" delay={1200} />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'android' ? 24 : 0}
        >
          <ScrollView
            contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 48 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Back */}
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
              <Text style={s.backText}>← Back</Text>
            </TouchableOpacity>

            {/* Logo */}
            <View style={s.logoRow}>
              <View style={s.logoWrap}>
                <View style={s.logoGlow} />
                <Text style={s.logoText}>FAF</Text>
                <View style={s.logoDot} />
              </View>
              <View>
                <Text style={s.appName}>Find A Friend</Text>
                <Text style={s.appSub}>Campus social universe</Text>
              </View>
            </View>

            {/* Card */}
            <Animated.View style={[s.card, cardStyle]}>
              {/* Tab switcher */}
              <View style={s.tabBar}>
                <Animated.View style={[s.tabIndicator, tabIndicatorStyle]} />
                <TouchableOpacity
                  style={s.tabBtn}
                  onPress={() => { setMode('signup'); setPassword(''); setConfirmPassword('') }}>
                  <Text style={[s.tabLabel, mode === 'signup' && s.tabLabelActive]}>Sign Up</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.tabBtn}
                  onPress={() => { setMode('signin'); setPassword(''); setConfirmPassword('') }}>
                  <Text style={[s.tabLabel, mode === 'signin' && s.tabLabelActive]}>Sign In</Text>
                </TouchableOpacity>
              </View>

              <View style={s.cardBody}>
                <AnimatedInput
                  label="University Email"
                  placeholder="yourname@unilag.edu.ng"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                />
                <AnimatedInput
                  label="Password"
                  placeholder={mode === 'signup' ? 'Min. 6 characters' : 'Your password'}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
                {mode === 'signup' && (
                  <AnimatedInput
                    label="Confirm Password"
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />
                )}

                {mode === 'signup' && (
                  <View style={s.infoCard}>
                    <View style={s.infoDot} />
                    <Text style={s.infoText}>
                      University email required — verified students only
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[s.btnPrimary, loading && s.btnDisabled]}
                  onPress={handleSubmit}
                  activeOpacity={0.85}
                  disabled={loading}
                >
                  <View style={s.btnGlow} />
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.btnText}>
                        {mode === 'signup' ? 'Create Account →' : 'Sign In →'}
                      </Text>
                  }
                </TouchableOpacity>

                <Text style={s.termsText}>
                  By continuing you agree to our{' '}
                  <Text style={s.termsLink}>Terms</Text>
                  {' '}and{' '}
                  <Text style={s.termsLink}>Privacy Policy</Text>
                </Text>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#07070f' },

  grid: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  gridLine: {
    position: 'absolute', left: 0, right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(167,139,250,0.05)',
  },

  scroll: { paddingHorizontal: 20, paddingTop: 12 },

  backBtn: { marginBottom: 24, paddingVertical: 4 },
  backText: { fontSize: 14, fontFamily: typography.fontMedium, color: '#a78bfa' },

  logoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 32,
  },
  logoWrap: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: 'rgba(167,139,250,0.08)',
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.35)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  logoGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderRadius: 16,
  },
  logoText: {
    fontSize: 17, fontFamily: typography.fontExtraBold,
    color: '#c4b5fd', letterSpacing: 1.5,
  },
  logoDot: {
    position: 'absolute', bottom: 7, right: 7,
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ade80',
  },
  appName: {
    fontSize: 18, fontFamily: typography.fontBold, color: '#f0e8ff',
  },
  appSub: {
    fontSize: 12, fontFamily: typography.fontRegular,
    color: 'rgba(196,181,253,0.45)', marginTop: 2,
  },

  card: {
    borderRadius: 24,
    backgroundColor: 'rgba(167,139,250,0.04)',
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.18)',
    overflow: 'hidden',
  },

  tabBar: {
    flexDirection: 'row', position: 'relative',
    borderBottomWidth: 0.5, borderColor: 'rgba(167,139,250,0.15)',
  },
  tabIndicator: {
    position: 'absolute', bottom: 0, left: 0,
    width: '50%', height: 2, borderRadius: 1, backgroundColor: '#a78bfa',
  },
  tabBtn: {
    flex: 1, paddingVertical: 16, alignItems: 'center',
  },
  tabLabel: {
    fontSize: 14, fontFamily: typography.fontSemiBold,
    color: 'rgba(196,181,253,0.4)',
  },
  tabLabelActive: { color: '#c4b5fd' },

  cardBody: { padding: 20, gap: 0 },

  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(52,211,153,0.08)',
    borderRadius: 12, padding: 12,
    borderWidth: 0.5, borderColor: 'rgba(52,211,153,0.2)',
    marginBottom: 16, marginTop: 4,
  },
  infoDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#34d399',
  },
  infoText: {
    flex: 1, fontSize: 12, fontFamily: typography.fontRegular,
    color: 'rgba(52,211,153,0.8)', lineHeight: 18,
  },

  btnPrimary: {
    borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#a78bfa', overflow: 'hidden',
    marginTop: 4, marginBottom: 14,
    shadowColor: '#a78bfa', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45, shadowRadius: 18, elevation: 10,
  },
  btnDisabled: { opacity: 0.55 },
  btnGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.08)' },
  btnText: {
    fontSize: 15, fontFamily: typography.fontBold, color: '#fff', letterSpacing: 0.3,
  },

  termsText: {
    fontSize: 11, fontFamily: typography.fontRegular,
    color: 'rgba(196,181,253,0.3)', textAlign: 'center',
  },
  termsLink: { color: 'rgba(167,139,250,0.6)' },
})
