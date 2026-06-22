/**
 * components/academic/StudyGroupCard.tsx
 * Study group card with join button.
 */
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { joinStudyGroup, leaveStudyGroup } from '../../lib/academic'
import type { StudyGroup } from '../../lib/academic'

import { useTheme } from '../../lib/theme'

interface StudyGroupCardProps {
  group: StudyGroup
}

export default function StudyGroupCard({ group }: StudyGroupCardProps) {
  const theme = useTheme()
  const [isMember, setIsMember] = useState(group.is_member ?? false)
  const [memberCount, setMemberCount] = useState(group.member_count)
  const [loading, setLoading] = useState(false)

  const isFull = group.max_members != null && memberCount >= group.max_members

  const handleJoin = async () => {
    if (isFull && !isMember) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setLoading(true)
    if (isMember) {
      setIsMember(false)
      setMemberCount(c => Math.max(0, c - 1))
      const { error } = await leaveStudyGroup(group.id)
      if (error) { setIsMember(true); setMemberCount(c => c + 1) }
    } else {
      setIsMember(true)
      setMemberCount(c => c + 1)
      const { error } = await joinStudyGroup(group.id)
      if (error) { setIsMember(false); setMemberCount(c => Math.max(0, c - 1)) }
    }
    setLoading(false)
  }

  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }, theme.cardShadow]}
      onPress={() => router.push(`/study-group/${group.id}` as any)}
      activeOpacity={0.85}>
      <View style={s.body}>
        <View style={s.icon}>
          <Ionicons name="people-outline" size={18} color="#60a5fa" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.name, { color: theme.text }]} numberOfLines={1}>{group.name}</Text>
          {group.courses && (
            <Text style={s.course}>
              {group.courses.code} · {group.courses.name}
            </Text>
          )}
          <View style={s.meta}>
            <Ionicons name="person-outline" size={11} color={theme.textFaint} />
            <Text style={[s.metaText, { color: theme.textMuted }]}>
              {memberCount}{group.max_members ? `/${group.max_members}` : ''} members
            </Text>
            {group.venue ? (
              <>
                <Ionicons name="location-outline" size={11} color={theme.textFaint} />
                <Text style={[s.metaText, { color: theme.textMuted }]} numberOfLines={1}>{group.venue}</Text>
              </>
            ) : null}
          </View>
        </View>
        <TouchableOpacity
          style={[s.joinBtn, isMember && s.joinedBtn, (isFull && !isMember) && s.fullBtn]}
          onPress={handleJoin}
          disabled={loading || (isFull && !isMember)}>
          {loading
            ? <ActivityIndicator size="small" color={isMember ? '#a78bfa' : '#fff'} />
            : <Text style={[s.joinText, isMember && s.joinedText]}>
                {isMember ? 'Leave' : isFull ? 'Full' : 'Join'}
              </Text>}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  card: {
    borderRadius: 14, padding: 12,
    marginHorizontal: 16, marginBottom: 8,
    borderWidth: 0.5,
  },
  body: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(96,165,250,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  name: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  course: { fontSize: 10, color: '#a78bfa', marginBottom: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  metaText: { fontSize: 10 },
  joinBtn: {
    backgroundColor: '#60a5fa', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    minWidth: 52, alignItems: 'center',
  },
  joinedBtn: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.3)',
  },
  fullBtn: { backgroundColor: 'rgba(128,128,128,0.1)', opacity: 0.6 },
  joinText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  joinedText: { color: '#ef4444' },
})
