import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { followUser, unfollowUser } from '../../lib/follows'
import { getInitials } from '../../lib/matching'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'
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
  const cardScale = useSharedValue(1)
  const btnScale = useSharedValue(1)
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }))
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }))

  const handleFollow = async () => {
    if (isCurrentUser) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    btnScale.value = withSpring(0.88, { damping: 10 })
    setTimeout(() => { btnScale.value = withSpring(1, { damping: 10 }) }, 100)
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
    <Animated.View style={[cardStyle, s.wrap]}>
      <TouchableOpacity
        style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPressIn={() => { cardScale.value = withSpring(0.97, { damping: 14 }) }}
        onPressOut={() => { cardScale.value = withSpring(1, { damping: 14 }) }}
        onPress={() => router.push(`/profile/${user.id}` as any)}
        activeOpacity={1}>

        {/* Left accent line */}
        <View style={[s.accentLine, { backgroundColor: following ? theme.accent : 'transparent' }]} />

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
          <Animated.View style={[
            btnStyle,
            s.followBtn,
            following
              ? { backgroundColor: theme.accentBg, borderWidth: 0.5, borderColor: theme.accentBorder }
              : { backgroundColor: theme.accent, shadowColor: theme.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 5 },
          ]}>
            <TouchableOpacity style={s.followBtnInner} onPress={handleFollow} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color={following ? theme.accent : '#fff'} />
              ) : (
                <Text style={[s.followText, following && { color: theme.accent }]}>
                  {following ? 'Following' : 'Follow'}
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}
      </TouchableOpacity>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 8 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, padding: 12, borderWidth: 0.5, overflow: 'hidden',
  },
  accentLine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: 2 },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
    borderWidth: 1.5, borderColor: '#a78bfa',
  },
  avatarImg: { width: 46, height: 46, borderRadius: 23 },
  initials: { fontSize: 14, fontFamily: typography.fontBold, color: '#c4b5fd' },
  info: { flex: 1 },
  name: { fontSize: 14, fontFamily: typography.fontSemiBold, marginBottom: 2 },
  dept: { fontSize: 11, fontFamily: typography.fontRegular, marginBottom: 2 },
  followers: { fontSize: 10, fontFamily: typography.fontRegular },
  followBtn: { borderRadius: 20, minWidth: 80, alignItems: 'center', overflow: 'hidden' },
  followBtnInner: { paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', width: '100%' },
  followText: { fontSize: 12, fontFamily: typography.fontSemiBold, color: '#fff' },
})
