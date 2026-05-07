import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState } from 'react'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../lib/theme'

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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    Alert.alert('Error', 'Not logged in')
    setLoading(false)
    return
  }

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      email: user.email,
      full_name: fullName.trim(),
      department,
      level,
      bio: bio.trim(),
      interests,
    })

  setLoading(false)

  if (error) {
    Alert.alert('Error saving profile', error.message)
  } else {
    router.replace('/(tabs)')
  }
}

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      <View style={s.progressBar}>
        {[1, 2, 3].map(i => (
          <View key={i} style={[s.progressStep, i <= step && s.progressStepActive]} />
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

        {step === 1 && (
          <>
            <Text style={s.title}>Tell us about you</Text>
            <Text style={s.subtitle}>Set up your FAF profile</Text>

            <View style={s.inputWrap}>
              <Text style={s.label}>Full name</Text>
              <TextInput
                style={s.input}
                placeholder="Your full name"
                placeholderTextColor="rgba(240,240,255,0.25)"
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            <View style={s.inputWrap}>
              <Text style={s.label}>Bio (optional)</Text>
              <TextInput
                style={[s.input, s.bioInput]}
                placeholder="Tell other students a little about yourself..."
                placeholderTextColor="rgba(240,240,255,0.25)"
                value={bio}
                onChangeText={setBio}
                multiline
                maxLength={160}
              />
              <Text style={s.charCount}>{bio.length}/160</Text>
            </View>

            <TouchableOpacity
              style={s.btnPrimary}
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
            <Text style={s.title}>Your department</Text>
            <Text style={s.subtitle}>Help others find you by course</Text>

            <View style={s.optionsGrid}>
              {departments.map((d, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.optionChip, department === d && s.optionChipActive]}
                  onPress={() => setDepartment(d)}>
                  <Text style={[s.optionText, department === d && s.optionTextActive]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[s.label, { marginTop: 20 }]}>Level</Text>
            <View style={s.levelRow}>
              {levels.map((l, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.levelChip, level === l && s.optionChipActive]}
                  onPress={() => setLevel(l)}>
                  <Text style={[s.optionText, level === l && s.optionTextActive]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.btnRow}>
              <TouchableOpacity style={s.btnSecondary} onPress={() => setStep(1)}>
                <Text style={s.btnSecText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnPrimary, { flex: 1 }]}
                onPress={() => setStep(3)}>
                <Text style={s.btnText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={s.title}>Your interests</Text>
            <Text style={s.subtitle}>
              Pick 3–8 things you love — this powers your matches
            </Text>

            <View style={s.interestsGrid}>
              {allInterests.map((interest, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    s.interestChip,
                    interests.includes(interest) && s.interestChipActive,
                  ]}
                  onPress={() => toggleInterest(interest)}>
                  <Text style={[
                    s.interestText,
                    interests.includes(interest) && s.interestTextActive,
                  ]}>
                    {interest}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.selectedCount}>
              {interests.length} selected {interests.length < 3 ? `(need ${3 - interests.length} more)` : '✓'}
            </Text>

            <View style={s.btnRow}>
              <TouchableOpacity style={s.btnSecondary} onPress={() => setStep(2)}>
                <Text style={s.btnSecText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnPrimary, { flex: 1 }, loading && s.btnDisabled]}
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
    backgroundColor: '#1c1c2e',
  },
  progressStepActive: { backgroundColor: '#a78bfa' },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '700', color: '#f0f0ff', marginBottom: 6 },
  subtitle: { fontSize: 14, color: 'rgba(240,240,255,0.4)', marginBottom: 28, lineHeight: 20 },
  inputWrap: { marginBottom: 18 },
  label: { fontSize: 12, color: 'rgba(240,240,255,0.4)', marginBottom: 8, fontWeight: '500' },
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
  bioInput: { height: 100, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: 'rgba(240,240,255,0.25)', textAlign: 'right', marginTop: 4 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1c1c2e',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  optionChipActive: {
    backgroundColor: 'rgba(167,139,250,0.2)',
    borderColor: '#a78bfa',
  },
  optionText: { fontSize: 13, color: 'rgba(240,240,255,0.5)' },
  optionTextActive: { color: '#a78bfa', fontWeight: '600' },
  levelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  levelChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1c1c2e',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  interestsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  interestChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1c1c2e',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  interestChipActive: {
    backgroundColor: 'rgba(167,139,250,0.2)',
    borderColor: '#a78bfa',
  },
  interestText: { fontSize: 13, color: 'rgba(240,240,255,0.5)' },
  interestTextActive: { color: '#a78bfa', fontWeight: '600' },
  selectedCount: {
    fontSize: 12,
    color: 'rgba(240,240,255,0.4)',
    marginBottom: 24,
    textAlign: 'center',
  },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnPrimary: {
    backgroundColor: '#a78bfa',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  btnSecondary: {
    backgroundColor: '#1c1c2e',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  btnSecText: { fontSize: 15, color: 'rgba(240,240,255,0.5)' },
})