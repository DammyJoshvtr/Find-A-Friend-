import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState } from 'react'
import { router } from 'expo-router'
import { client } from '../../lib/aws'
import { supabase } from '../../lib/supabase'
import { getCurrentUser } from 'aws-amplify/auth'
import { useTheme } from '../../lib/theme'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { registerForPushNotifications, savePushToken, subscribeToWebPush } from '../../lib/notifications'

const allInterests = [
  'Music', 'Tech', 'Art', 'Sports', 'Gaming', 'Photography',
  'Dance', 'Debate', 'Fitness', 'Poetry', 'Hiking', 'Chess',
  'Fashion', 'Film', 'Reading', 'Cooking', 'Travel', 'Design',
  'Robotics', 'Open Source', 'Drama', 'Journalism', 'Business',
]

const departments = [
  'Computer Science', 'Engineering', 'Law', 'Medicine',
  'Architecture', 'Economics', 'Mass Communication',
  'Pharmacy', 'Education', 'Social Sciences', 'Other',
]

const levels = ['100L', '200L', '300L', '400L', '500L', 'Postgraduate']

export default function OnboardingScreen() {
  const theme = useTheme()
  const [step, setStep] = useState(1)
  const [fullName, setFullName] = useState('')
  const [department, setDepartment] = useState('')
  const [manualDepartment, setManualDepartment] = useState('')
  const [level, setLevel] = useState('')
  const [bio, setBio] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const toggleInterest = (interest: string) => {
    setInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : prev.length < 8 ? [...prev, interest] : prev
    )
  }

 const saveProfile = async () => {
  if (!fullName.trim()) {
    Alert.alert('Error', 'Please enter your full name')
    return
  }
  if (interests.length < 3) {
    Alert.alert('Error', 'Please select at least 3 interests')
    return
  }
  setLoading(true)

  const user = await getCurrentUser()
  if (!user) {
    Alert.alert('Error', 'Not logged in')
    setLoading(false)
    return
  }

  let badgeType = 'guest'
  let badgeColor = '#ec4899'
  try {
    const wasVerifiedViaCode = await AsyncStorage.getItem('verified_via_code_' + user.username)
    if (wasVerifiedViaCode === 'true') {
      badgeType = 'verified'
      badgeColor = '#a78bfa'
    }
  } catch (e) {
    console.warn('Failed to read verified_via_code flag:', e)
  }

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.userId,
      email: user.username,
      full_name: fullName.trim(),
      department: department === 'Other' ? manualDepartment.trim() : department,
      level,
      bio: bio.trim(),
      interests,
      badge_type: badgeType,
      badge_color: badgeColor,
    })

  setLoading(false)

  if (error) {
    Alert.alert('Error saving profile', error.message)
  } else {
    // Request push notification permission during onboarding so the token
    // is saved before the user enters the app for the first time.
    const token = await registerForPushNotifications()
    if (token) await savePushToken(token)

    // Web Push (PWA / iOS): subscribe from a user-gesture context.
    // iOS Safari requires requestPermission() to come from a tap — this button
    // is the perfect place to do it before navigating away.
    if (Platform.OS === 'web') {
      try {
        await subscribeToWebPush(user.userId)
      } catch {}
    }

    router.replace('/(tabs)')
  }
}

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      <View style={s.progressBar}>
        {[1, 2, 3].map(i => (
          <View key={i} style={[s.progressStep, { backgroundColor: theme.border }, i <= step && { backgroundColor: theme.accent }]} />
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

        {step === 1 && (
          <>
            <Text style={[s.title, { color: theme.text }]}>Tell us about you</Text>
            <Text style={[s.subtitle, { color: theme.textMuted }]}>Set up your FAF profile</Text>

            <View style={s.inputWrap}>
              <Text style={[s.label, { color: theme.textMuted }]}>Full name</Text>
              <TextInput
                style={[s.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                placeholder="Your full name"
                placeholderTextColor={theme.textFaint}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            <View style={s.inputWrap}>
              <Text style={[s.label, { color: theme.textMuted }]}>Bio (optional)</Text>
              <TextInput
                style={[s.input, s.bioInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                placeholder="Tell other students a little about yourself..."
                placeholderTextColor={theme.textFaint}
                value={bio}
                onChangeText={setBio}
                multiline
                maxLength={160}
              />
              <Text style={[s.charCount, { color: theme.textFaint }]}>{bio.length}/160</Text>
            </View>

            <TouchableOpacity
              style={[s.btnPrimary, { backgroundColor: theme.accent }]}
              onPress={() => {
                if (!fullName.trim()) {
                  Alert.alert('Error', 'Please enter your full name')
                  return
                }
                setStep(2)
              }}>
              <Text style={s.btnText}>Continue</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={[s.title, { color: theme.text }]}>Your department</Text>
            <Text style={[s.subtitle, { color: theme.textMuted }]}>Help others find you by course</Text>

            <View style={s.optionsGrid}>
              {departments.map((d, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    s.optionChip,
                    { backgroundColor: theme.card, borderColor: theme.border },
                    department === d && { backgroundColor: theme.accent + '20', borderColor: theme.accent }
                  ]}
                  onPress={() => setDepartment(d)}>
                  <Text style={[
                    s.optionText,
                    { color: theme.textMuted },
                    department === d && { color: theme.accent, fontWeight: '600' }
                  ]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {department === 'Other' && (
              <View style={[s.inputWrap, { marginTop: 16 }]}>
                <Text style={[s.label, { color: theme.textMuted }]}>Enter your department</Text>
                <TextInput
                  style={[s.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                  placeholder="e.g. Political Science"
                  placeholderTextColor={theme.textFaint}
                  value={manualDepartment}
                  onChangeText={setManualDepartment}
                  autoFocus
                />
              </View>
            )}

            <Text style={[s.label, { marginTop: 20, color: theme.textMuted }]}>Level</Text>
            <View style={s.levelRow}>
              {levels.map((l, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    s.levelChip,
                    { backgroundColor: theme.card, borderColor: theme.border },
                    level === l && { backgroundColor: theme.accent + '20', borderColor: theme.accent }
                  ]}
                  onPress={() => setLevel(l)}>
                  <Text style={[
                    s.optionText,
                    { color: theme.textMuted },
                    level === l && { color: theme.accent, fontWeight: '600' }
                  ]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.btnRow}>
              <TouchableOpacity style={[s.btnSecondary, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => setStep(1)}>
                <Text style={[s.btnSecText, { color: theme.textMuted }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnPrimary, { flex: 1, backgroundColor: theme.accent }]}
                onPress={() => setStep(3)}>
                <Text style={s.btnText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={[s.title, { color: theme.text }]}>Your interests</Text>
            <Text style={[s.subtitle, { color: theme.textMuted }]}>
              Pick 3–8 things you love — this powers your matches
            </Text>

            <View style={s.interestsGrid}>
              {allInterests.map((interest, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    s.interestChip,
                    { backgroundColor: theme.card, borderColor: theme.border },
                    interests.includes(interest) && { backgroundColor: theme.accent + '20', borderColor: theme.accent },
                  ]}
                  onPress={() => toggleInterest(interest)}>
                  <Text style={[
                    s.interestText,
                    { color: theme.textMuted },
                    interests.includes(interest) && { color: theme.accent, fontWeight: '600' },
                  ]}>
                    {interest}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[s.selectedCount, { color: theme.textMuted }]}>
              {interests.length} selected {interests.length < 3 ? `(need ${3 - interests.length} more)` : '✓'}
            </Text>

            <View style={s.btnRow}>
              <TouchableOpacity style={[s.btnSecondary, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => setStep(2)}>
                <Text style={[s.btnSecText, { color: theme.textMuted }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnPrimary, { flex: 1, backgroundColor: theme.accent }, loading && s.btnDisabled]}
                onPress={saveProfile}
                disabled={loading}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnText}>Enter FAF 🚀</Text>
                }
              </TouchableOpacity>
            </View>
          </>
        )}

      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  progressBar: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 8,
    marginBottom: 8,
  },
  progressStep: {
    flex: 1, height: 4, borderRadius: 2,
  },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14, marginBottom: 28, lineHeight: 20 },
  inputWrap: { marginBottom: 18 },
  label: { fontSize: 12, marginBottom: 8, fontWeight: '500' },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    borderWidth: 0.5,
  },
  bioInput: { height: 100, textAlignVertical: 'top' },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: 4 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 0.5,
  },
  optionText: { fontSize: 13 },
  levelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  levelChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 0.5,
  },
  interestsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  interestChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 0.5,
  },
  interestText: { fontSize: 13 },
  selectedCount: {
    fontSize: 12,
    marginBottom: 24,
    textAlign: 'center',
  },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnPrimary: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  btnSecondary: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 0.5,
  },
  btnSecText: { fontSize: 15 },
})
