import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTheme } from '../lib/theme'
import { supabase } from '../lib/supabase'
import { getCurrentProfile } from '../lib/profiles'

export default function VerificationScreen() {
  const theme = useTheme()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [createdAt, setCreatedAt] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? '')
      setCreatedAt(data.user?.created_at ?? '')
    })
    getCurrentProfile().then(p => {
      if (p) setFullName(p.full_name ?? '')
    })
  }, [])

  const joinDate = createdAt
    ? new Date(createdAt).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'

  const isUniversity = email.includes('.edu') || email.includes('ac.uk')
    || email.includes('edu.ng') || email.includes('ac.za') || email.includes('.edu.')

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.card }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.text }]}>Verification</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Badge */}
        <View style={[s.badge, { backgroundColor: 'rgba(52,211,153,0.08)', borderColor: 'rgba(52,211,153,0.2)' }]}>
          <View style={s.badgeIcon}>
            <Ionicons name="shield-checkmark" size={36} color="#34d399" />
          </View>
          <Text style={[s.badgeTitle, { color: theme.text }]}>Verified Student</Text>
          <Text style={[s.badgeSub, { color: theme.textMuted }]}>
            Your university email has been verified. You have full access to all FAF features.
          </Text>
        </View>

        {/* Details */}
        <Text style={[s.sectionLabel, { color: theme.textMuted }]}>ACCOUNT DETAILS</Text>
        <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {[
            { icon: '👤', label: 'Name',      value: fullName || '—' },
            { icon: '📧', label: 'Email',     value: email || '—' },
            { icon: '🎓', label: 'Email type', value: isUniversity ? 'University email' : 'Standard email' },
            { icon: '📅', label: 'Joined',    value: joinDate },
          ].map((item, i, arr) => (
            <View
              key={item.label}
              style={[s.row, i < arr.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: theme.border2 }]}>
              <Text style={s.icon}>{item.icon}</Text>
              <Text style={[s.rowLabel, { color: theme.textMuted }]}>{item.label}</Text>
              <Text style={[s.rowValue, { color: theme.text }]}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* How it works */}
        <Text style={[s.sectionLabel, { color: theme.textMuted }]}>HOW VERIFICATION WORKS</Text>
        <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {[
            { icon: '1️⃣', text: 'Sign up with your university email address' },
            { icon: '2️⃣', text: 'FAF checks the email domain against known university domains' },
            { icon: '3️⃣', text: 'Verified badge is granted automatically' },
            { icon: '4️⃣', text: 'Only verified students can post, comment, and join clubs' },
          ].map((step, i, arr) => (
            <View
              key={i}
              style={[s.step, i < arr.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: theme.border2 }]}>
              <Text style={s.icon}>{step.icon}</Text>
              <Text style={[s.stepText, { color: theme.textMuted }]}>{step.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '600' },
  badge: {
    borderRadius: 20, padding: 24, alignItems: 'center', gap: 10,
    borderWidth: 0.5, marginBottom: 4,
  },
  badgeIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(52,211,153,0.12)', alignItems: 'center', justifyContent: 'center' },
  badgeTitle: { fontSize: 20, fontWeight: '700' },
  badgeSub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  card: { borderRadius: 14, borderWidth: 0.5, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  icon: { fontSize: 18, width: 26, textAlign: 'center' },
  rowLabel: { flex: 1, fontSize: 13 },
  rowValue: { fontSize: 13, fontWeight: '500', maxWidth: '55%', textAlign: 'right' },
  step: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
  stepText: { flex: 1, fontSize: 13, lineHeight: 20 },
})
