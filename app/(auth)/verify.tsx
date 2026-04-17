import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState } from 'react'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'

export default function VerifyScreen() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')

  const isUniversityEmail = (e: string) => {
    const validDomains = [
      'unilag.edu.ng', 'ui.edu.ng', 'oau.edu.ng', 'unn.edu.ng',
      'abu.edu.ng', 'uniben.edu.ng', 'lasu.edu.ng', 'yabatech.edu.ng',
      'edu.ng', 'ac.uk', 'edu', 'ac.za',
    ]
    return validDomains.some(d => e.toLowerCase().endsWith(d))
  }

  const sendOTP = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your university email')
      return
    }
    if (!isUniversityEmail(email)) {
      Alert.alert(
        'Invalid email',
        'Please use your official university email address (e.g. yourname@unilag.edu.ng)'
      )
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase().trim(),
      options: { shouldCreateUser: true },
    })
    setLoading(false)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setOtpSent(true)
    }
  }

  const verifyOTP = async () => {
    if (!otp || otp.length < 6) {
      Alert.alert('Error', 'Please enter the 6-digit code from your email')
      return
    }
    setLoading(true)
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.toLowerCase().trim(),
      token: otp,
      type: 'email',
    })
    setLoading(false)
    if (error) {
      Alert.alert('Error', error.message)
    } else if (data.session) {
      router.replace('/(auth)/onboarding')
    }
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.content}>

        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={s.iconWrap}>
          <Text style={s.icon}>🎓</Text>
        </View>

        <Text style={s.title}>
          {otpSent ? 'Check your email' : 'Verify your student ID'}
        </Text>
        <Text style={s.subtitle}>
          {otpSent
            ? `We sent a 6-digit code to ${email}`
            : 'Enter your official university email to join FAF'}
        </Text>

        {!otpSent ? (
          <>
            <View style={s.inputWrap}>
              <Text style={s.inputLabel}>University email address</Text>
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

            <View style={s.infoCard}>
              <Text style={s.infoTitle}>✓ Why we verify</Text>
              <Text style={s.infoText}>
                Every FAF user is a real confirmed student. No outsiders, no fake accounts — just your campus community.
              </Text>
            </View>

            <TouchableOpacity
              style={[s.btnPrimary, loading && s.btnDisabled]}
              onPress={sendOTP}
              disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>Send verification code</Text>
              }
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={s.inputWrap}>
              <Text style={s.inputLabel}>6-digit verification code</Text>
              <TextInput
                style={[s.input, s.otpInput]}
                placeholder="000000"
                placeholderTextColor="rgba(240,240,255,0.25)"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            <TouchableOpacity
              style={[s.btnPrimary, loading && s.btnDisabled]}
              onPress={verifyOTP}
              disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>Verify & join FAF</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={s.resendBtn} onPress={() => setOtpSent(false)}>
              <Text style={s.resendText}>Wrong email? Go back</Text>
            </TouchableOpacity>
          </>
        )}

      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d14' },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
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
  inputWrap: { marginBottom: 16 },
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
  otpInput: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: 'rgba(52,211,153,0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
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
    marginBottom: 12,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  resendBtn: { alignItems: 'center', paddingVertical: 8 },
  resendText: { fontSize: 13, color: 'rgba(240,240,255,0.4)' },
})