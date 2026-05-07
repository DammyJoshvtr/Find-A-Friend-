import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../lib/theme'
import { useState } from 'react'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'

type Mode = 'signup' | 'signin'

const UNIVERSITY_DOMAINS = [
  'unilag.edu.ng', 'ui.edu.ng', 'oau.edu.ng', 'unn.edu.ng',
  'abu.edu.ng', 'uniben.edu.ng', 'lasu.edu.ng', 'yabatech.edu.ng',
  'edu.ng', 'ac.uk', 'edu', 'ac.za',
]

function isUniversityEmail(email: string) {
  return UNIVERSITY_DOMAINS.some(d => email.toLowerCase().endsWith(d))
}

export default function VerifyScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [mode, setMode] = useState<Mode>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    const trimmedEmail = email.toLowerCase().trim()

    if (!trimmedEmail || !password) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }
    if (!isUniversityEmail(trimmedEmail)) {
      Alert.alert('University email required', 'Please use your official university email (e.g. yourname@unilag.edu.ng)')
      return
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters')
      return
    }
    if (mode === 'signup' && password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match')
      return
    }

    setLoading(true)

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { data: { email: trimmedEmail } },
      })
      setLoading(false)
      if (error) {
        if (error.message.toLowerCase().includes('already registered')) {
          Alert.alert('Account exists', 'An account with this email already exists.', [
            { text: 'Sign in', onPress: () => setMode('signin') },
          ])
        } else {
          Alert.alert('Sign up failed', error.message)
        }
        return
      }
      if (data.session) {
        router.replace('/(auth)/onboarding')
      } else {
        // Email confirmation is ON — try signing in anyway
        const { data: sd } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password })
        if (sd?.session) {
          router.replace('/(auth)/onboarding')
        } else {
          Alert.alert('Confirm your email', `A link was sent to ${trimmedEmail}. Click it then sign in here.`, [
            { text: 'OK', onPress: () => setMode('signin') },
          ])
        }
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password })
      setLoading(false)
      if (error) {
        if (error.message.toLowerCase().includes('not confirmed')) {
          Alert.alert('Email not confirmed', 'Check your inbox for a confirmation link.')
        } else {
          Alert.alert('Sign in failed', 'Wrong email or password.')
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
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'android' ? 24 : 0}
      >
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>

          <View style={s.iconWrap}>
            <Text style={s.icon}>🎓</Text>
          </View>

          <Text style={s.title}>{mode === 'signup' ? 'Join FAF' : 'Welcome back'}</Text>
          <Text style={s.subtitle}>
            {mode === 'signup'
              ? 'Create your account with your university email'
              : 'Sign in to your FAF account'}
          </Text>

          <View style={s.inputWrap}>
            <Text style={s.inputLabel}>University email</Text>
            <TextInput
              style={s.input}
              placeholder="yourname@unilag.edu.ng"
              placeholderTextColor="rgba(240,240,255,0.25)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={s.inputWrap}>
            <Text style={s.inputLabel}>Password</Text>
            <TextInput
              style={s.input}
              placeholder={mode === 'signup' ? 'Create a password (min. 6 chars)' : 'Your password'}
              placeholderTextColor="rgba(240,240,255,0.25)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {mode === 'signup' && (
            <View style={s.inputWrap}>
              <Text style={s.inputLabel}>Confirm password</Text>
              <TextInput
                style={s.input}
                placeholder="Repeat your password"
                placeholderTextColor="rgba(240,240,255,0.25)"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
          )}

          {mode === 'signup' && (
            <View style={s.infoCard}>
              <Text style={s.infoTitle}>✓ Students only</Text>
              <Text style={s.infoText}>
                FAF is for verified students only. No outsiders, no fake accounts — just your campus community.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[s.btnPrimary, loading && s.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>{mode === 'signup' ? 'Create account' : 'Sign in'}</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={s.toggleBtn}
            onPress={() => {
              setMode(m => m === 'signup' ? 'signin' : 'signup')
              setPassword('')
              setConfirmPassword('')
            }}
          >
            <Text style={s.toggleText}>
              {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 16 },
  backBtn: { marginBottom: 24 },
  backText: { fontSize: 15, color: '#a78bfa' },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(167,139,250,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)',
  },
  icon: { fontSize: 36 },
  title: { fontSize: 24, fontWeight: '700', color: '#f0f0ff', marginBottom: 8 },
  subtitle: { fontSize: 14, color: 'rgba(240,240,255,0.45)', lineHeight: 22, marginBottom: 28 },
  inputWrap: { marginBottom: 14 },
  inputLabel: { fontSize: 12, color: 'rgba(240,240,255,0.4)', marginBottom: 8, fontWeight: '500' },
  input: {
    backgroundColor: '#1c1c2e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: '#f0f0ff',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  infoCard: {
    backgroundColor: 'rgba(52,211,153,0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    marginTop: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(52,211,153,0.2)',
  },
  infoTitle: { fontSize: 12, fontWeight: '600', color: '#34d399', marginBottom: 6 },
  infoText: { fontSize: 12, color: 'rgba(240,240,255,0.5)', lineHeight: 18 },
  btnPrimary: {
    backgroundColor: '#a78bfa',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  toggleBtn: { alignItems: 'center', paddingVertical: 10 },
  toggleText: { fontSize: 13, color: 'rgba(240,240,255,0.4)' },
})
