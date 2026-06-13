/**
 * app/badges-info.tsx
 * Guide screen explaining what each user badge represents on FAF.
 */
import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../lib/theme'
import { typography } from '../lib/typography'
import VerifiedBadge, { BADGE_COLORS, BADGE_LABELS } from '../components/ui/VerifiedBadge'

export default function BadgesInfoScreen() {
  const theme = useTheme()

  const badges = [
    { type: 'verified', desc: 'Verified student identity. Automatically granted to accounts signed up with official university email domains.' },
    { type: 'vendor', desc: 'Approved campus vendors, local shops, food spots, or student entrepreneurs.' },
    { type: 'official', desc: 'Official institution, university departments, student government, or club administration accounts.' },
    { type: 'moderator', desc: 'Community moderators who help moderate the social feed, posts, and campus clubs.' },
    { type: 'staff', desc: 'University faculty, lecturers, staff, or department administrators.' },
    { type: 'alumni', desc: 'FAF alumni who have graduated but remain connected to the campus community.' },
    { type: 'guest', desc: 'External speakers, prospective students, or campus guests.' },
  ]

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>Badges Guide</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={[s.introText, { color: theme.textMuted }]}>
          Badges help verify identity and build trust within the FAF campus community. Here is what each badge represents:
        </Text>

        <View style={s.badgeList}>
          {badges.map((b) => {
            const label = BADGE_LABELS[b.type] || b.type
            const color = BADGE_COLORS[b.type] || '#3b82f6'
            return (
              <View key={b.type} style={[s.badgeCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={[s.iconWrap, { backgroundColor: color + '12', borderColor: color + '22' }]}>
                  <VerifiedBadge type={b.type} size={20} />
                </View>
                <View style={s.badgeDetails}>
                  <Text style={[s.badgeLabel, { color }]}>{label}</Text>
                  <Text style={[s.badgeDesc, { color: theme.textMuted }]}>{b.desc}</Text>
                </View>
              </View>
            )
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 0.5
  },
  backBtn: { padding: 8, width: 40 },
  headerTitle: { fontSize: 18, fontWeight: '700', fontFamily: typography.fontBold },
  introText: {
    fontSize: 14, fontFamily: typography.fontRegular,
    lineHeight: 20, marginBottom: 20
  },
  badgeList: { gap: 14 },
  badgeCard: {
    flexDirection: 'row', gap: 14,
    padding: 16, borderRadius: 20,
    borderWidth: 0.5, alignItems: 'flex-start'
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5
  },
  badgeDetails: { flex: 1, gap: 4 },
  badgeLabel: { fontSize: 14, fontFamily: typography.fontSemiBold },
  badgeDesc: { fontSize: 12, fontFamily: typography.fontRegular, lineHeight: 17 }
})
