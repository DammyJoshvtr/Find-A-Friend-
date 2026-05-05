/**
 * components/discover/UserCard.tsx
 * User card with follow/unfollow toggle.
 */
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { followUser, unfollowUser } from '../../lib/follows'
import { getInitials } from '../../lib/matching'
import type { FollowProfile } from '../../lib/follows'

interface UserCardProps {
  user: FollowProfile
  isFollowing?: boolean
  isCurrentUser?: boolean
}

export default function UserCard({ user, isFollowing: initialFollowing = false, isCurrentUser }: UserCardProps) {
  const [following, setFollowing] = useState(initialFollowing)
  const [loading, setLoading] = useState(false)

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

  const handlePress = () => {
    router.push(`/profile/${user.id}` as any)
  }

  return (
    <TouchableOpacity style={s.card} onPress={handlePress} activeOpacity={0.85}>
      <View style={s.avatar}>
        {user.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={s.avatarImg} />
        ) : (
          <Text style={s.initials}>{getInitials(user.full_name ?? '??')}</Text>
        )}
      </View>

      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>{user.full_name ?? 'Student'}</Text>
        {user.department ? (
          <Text style={s.dept} numberOfLines={1}>
            {user.department}{user.level ? ` · ${user.level}` : ''}
          </Text>
        ) : null}
        <Text style={s.followers}>{user.follower_count ?? 0} followers</Text>
      </View>

      {!isCurrentUser && (
        <TouchableOpacity
          style={[s.followBtn, following && s.followingBtn]}
          onPress={handleFollow}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color={following ? '#a78bfa' : '#fff'} />
          ) : (
            <Text style={[s.followText, following && s.followingText]}>
              {following ? 'Following' : 'Follow'}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1c1c2e',
    borderRadius: 14, padding: 12,
    marginHorizontal: 16, marginBottom: 8,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#2a1e40',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
    borderWidth: 1.5, borderColor: '#a78bfa',
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  initials: { fontSize: 14, fontWeight: '700', color: '#c4b5fd' },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: '#f0f0ff', marginBottom: 2 },
  dept: { fontSize: 11, color: 'rgba(240,240,255,0.4)', marginBottom: 2 },
  followers: { fontSize: 10, color: 'rgba(240,240,255,0.3)' },
  followBtn: {
    backgroundColor: '#a78bfa', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
    minWidth: 72, alignItems: 'center',
  },
  followingBtn: {
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.4)',
  },
  followText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  followingText: { color: '#a78bfa' },
})
