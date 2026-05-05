/**
 * components/clubs/ClubCard.tsx
 * Club card with join/joined toggle.
 */
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { joinClub, leaveClub } from '../../lib/clubs'
import type { Club } from '../../lib/clubs'

interface ClubCardProps {
  club: Club
  compact?: boolean
}

export default function ClubCard({ club, compact }: ClubCardProps) {
  const [isMember, setIsMember] = useState(club.is_member ?? false)
  const [memberCount, setMemberCount] = useState(club.member_count)
  const [loading, setLoading] = useState(false)

  const handleJoin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setLoading(true)
    if (isMember) {
      setIsMember(false)
      setMemberCount(c => Math.max(0, c - 1))
      const { error } = await leaveClub(club.id)
      if (error) { setIsMember(true); setMemberCount(c => c + 1) }
    } else {
      setIsMember(true)
      setMemberCount(c => c + 1)
      const { error } = await joinClub(club.id)
      if (error) { setIsMember(false); setMemberCount(c => Math.max(0, c - 1)) }
    }
    setLoading(false)
  }

  const handlePress = () => {
    router.push(`/club/${club.id}` as any)
  }

  if (compact) {
    return (
      <TouchableOpacity style={s.compactCard} onPress={handlePress}>
        {club.cover_url ? (
          <Image source={{ uri: club.cover_url }} style={s.compactCover} resizeMode="cover" />
        ) : (
          <View style={[s.compactCover, s.compactCoverPlaceholder, { backgroundColor: club.color + '22' }]}>
            <Ionicons name="people" size={20} color={club.color || '#a78bfa'} />
          </View>
        )}
        <Text style={s.compactName} numberOfLines={1}>{club.name}</Text>
        <Text style={s.compactMembers}>{memberCount} members</Text>
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity style={s.card} onPress={handlePress} activeOpacity={0.85}>
      {club.cover_url ? (
        <Image source={{ uri: club.cover_url }} style={s.cover} resizeMode="cover" />
      ) : (
        <View style={[s.cover, s.coverPlaceholder, { backgroundColor: club.color + '22' }]}>
          <Ionicons name="people-outline" size={28} color={club.color || '#a78bfa'} />
        </View>
      )}

      <View style={s.body}>
        <View style={{ flex: 1 }}>
          <Text style={s.name} numberOfLines={1}>{club.name}</Text>
          <Text style={s.category}>{club.category}</Text>
          <Text style={s.members}>{memberCount} members</Text>
        </View>

        <TouchableOpacity
          style={[s.joinBtn, isMember && s.joinedBtn]}
          onPress={handleJoin}
          disabled={loading}>
          {loading
            ? <ActivityIndicator size="small" color={isMember ? '#a78bfa' : '#fff'} />
            : <Text style={[s.joinText, isMember && s.joinedText]}>
                {isMember ? 'Joined' : 'Join'}
              </Text>}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#1c1c2e',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cover: { width: '100%', height: 100 },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  body: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, padding: 12,
  },
  name: { fontSize: 14, fontWeight: '600', color: '#f0f0ff', marginBottom: 2 },
  category: { fontSize: 10, color: 'rgba(240,240,255,0.35)', marginBottom: 2 },
  members: { fontSize: 11, color: 'rgba(240,240,255,0.3)' },
  joinBtn: {
    backgroundColor: '#a78bfa', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 7,
    minWidth: 60, alignItems: 'center',
  },
  joinedBtn: {
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.4)',
  },
  joinText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  joinedText: { color: '#a78bfa' },
  // Compact
  compactCard: {
    width: 110,
    backgroundColor: '#1c1c2e',
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
    marginRight: 10,
  },
  compactCover: { width: '100%', height: 70 },
  compactCoverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  compactName: {
    fontSize: 11, fontWeight: '600', color: '#f0f0ff',
    paddingHorizontal: 8, paddingTop: 6,
  },
  compactMembers: {
    fontSize: 9, color: 'rgba(240,240,255,0.35)',
    paddingHorizontal: 8, paddingBottom: 8,
  },
})
