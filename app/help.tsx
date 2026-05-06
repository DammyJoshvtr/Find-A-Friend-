import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import { useTheme } from '../lib/theme'

const FAQS = [
  {
    q: 'What is FAF?',
    a: 'FAF (For All Friends) is a social app exclusively for university students. You can share posts, stories, join clubs, find events, and connect with your campus community.',
  },
  {
    q: 'How do stories work?',
    a: 'Stories are photos or short videos that disappear after 24 hours. Only people who follow you can see your stories.',
  },
  {
    q: 'What is the Confession Board?',
    a: 'The Confession Board lets you post anonymously. Other students cannot see your identity, but admins can view it to prevent abuse.',
  },
  {
    q: 'How do I join a club?',
    a: 'Go to More → Clubs & Societies. Browse available clubs and tap "Join". You\'ll instantly see club posts in your feed.',
  },
  {
    q: 'How do Vendors work?',
    a: 'Businesses and student vendors can apply to list deals on FAF. All vendors are manually approved by admins before going live.',
  },
  {
    q: 'How do I report a post or user?',
    a: 'Tap the "···" menu on any post and select "Report post". Our admin team reviews all reports within 24 hours.',
  },
  {
    q: 'Can I delete my account?',
    a: 'Yes. Go to More → Account → Delete account. This permanently removes all your data and cannot be undone.',
  },
  {
    q: 'How do I change my profile picture?',
    a: 'Go to More → Edit profile, then tap your avatar photo to pick a new one from your gallery.',
  },
]

export default function HelpScreen() {
  const theme = useTheme()
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.card }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.text }]}>Help & Support</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} showsVerticalScrollIndicator={false}>
        <Text style={[s.sectionLabel, { color: theme.textMuted }]}>FREQUENTLY ASKED QUESTIONS</Text>

        {FAQS.map((faq, i) => (
          <TouchableOpacity
            key={i}
            style={[s.faqCard, { backgroundColor: theme.card, borderColor: openIndex === i ? theme.accent : theme.border }]}
            onPress={() => setOpenIndex(openIndex === i ? null : i)}
            activeOpacity={0.8}>
            <View style={s.faqHeader}>
              <Text style={[s.faqQ, { color: theme.text }]}>{faq.q}</Text>
              <Ionicons
                name={openIndex === i ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.textMuted}
              />
            </View>
            {openIndex === i && (
              <Text style={[s.faqA, { color: theme.textMuted }]}>{faq.a}</Text>
            )}
          </TouchableOpacity>
        ))}

        <View style={[s.contactCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={s.contactIcon}>📧</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.contactTitle, { color: theme.text }]}>Contact support</Text>
            <Text style={[s.contactSub, { color: theme.textMuted }]}>support@faf.app</Text>
          </View>
        </View>

        <View style={{ height: 20 }} />
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
  sectionLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4, letterSpacing: 0.5 },
  faqCard: { borderRadius: 14, padding: 14, borderWidth: 0.5 },
  faqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  faqQ: { flex: 1, fontSize: 14, fontWeight: '600' },
  faqA: { fontSize: 13, lineHeight: 20, marginTop: 10 },
  contactCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, borderRadius: 14, borderWidth: 0.5, marginTop: 8,
  },
  contactIcon: { fontSize: 24 },
  contactTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  contactSub: { fontSize: 13 },
})
