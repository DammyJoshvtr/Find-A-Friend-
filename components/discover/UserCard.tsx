import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { followUser, unfollowUser } from '../../lib/follows'
import { getInitials } from '../../lib/matching'
import { useTheme } from '../../lib/theme'
import type { FollowProfile } from '../../lib/follows'

interface UserCardProps {
  user: FollowProfile
  isFollowing?: boolean
  isCurrentUser?: boolean
}

export default function UserCard({ user, isFollowing: initialFollowing = false, isCurrentUser }: UserCardProps) {
  const [following, setFollowing] = useState(initialFollowing)
  const [loading, setLoading] = useState(false)
  const theme = useTheme()

  const handleFollow = async () => {
    if (isCurrentUser) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setLoading(true)
    if (following) {
      setFollowing(false)
      const { error } = await unfollowUser(user.id)
      if (error) setFollowing(true)
    } else {
      setFollowing(true)
      const { error } = await followUser(user.id)
      if (error) setFollowing(false)
    }
    setLoading(false)
  }

  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={() => router.push(`/profile/${user.id}` as any)} activeOpacity={0.85}>
      <View style={[s.avatar, { backgroundColor: theme.card2 }]}>
        {user.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={s.avatarImg} />
        ) : (
          <Text style={s.initials}>{getInitials(user.full_name ?? '??')}</Text>
        )}
      </View>

      <View style={s.info}>
        <Text style={[s.name, { color: theme.text }]} numberOfLines={1}>{user.full_name ?? 'Student'}</Text>
        {user.department ? (
          <Text style={[s.dept, { color: theme.textMuted }]} numberOfLines={1}>
            {user.department}{user.level ? ` · ${user.level}` : ''}
          </Text>
        ) : null}
        <Text style={[s.followers, { color: theme.textFaint }]}>{user.follower_count ?? 0} followers</Text>
      </View>

      {!isCurrentUser && (
        <TouchableOpacity
          style={[s.followBtn, { backgroundColor: theme.accent }, following && { backgroundColor: theme.accentBg, borderWidth: 0.5, borderColor: theme.accentBorder }]}
          onPress={handleFollow} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color={following ? theme.accent : '#fff'} />
          ) : (
            <Text style={[s.followText, following && { color: theme.accent }]}>
              {following ? 'Following' : 'Follow'}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 12, marginHorizontal: 16, marginBottom: 8, borderWidth: 0.5 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, borderWidth: 1.5, borderColor: '#a78bfa' },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  initials: { fontSize: 14, fontWeight: '700', color: '#c4b5fd' },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  dept: { fontSize: 11, marginBottom: 2 },
  followers: { fontSize: 10 },
  followBtn: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, minWidth: 72, alignItems: 'center' },
  followText: { fontSize: 12, fontWeight: '600', color: '#fff' },
})
