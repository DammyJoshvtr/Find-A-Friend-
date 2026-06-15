import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { followUser, unfollowUser } from '../../lib/follows'
import { getInitials } from '../../lib/matching'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'
import type { FollowProfile } from '../../lib/follows'
import VerifiedBadge from '../ui/VerifiedBadge'
import { likeUser, unlikeUser } from '../../lib/discoverLikes'
import type { ConnectionStatus } from '../../lib/discoverLikes'

interface UserCardProps {
  user: FollowProfile
  isFollowing?: boolean
  initialStatus?: ConnectionStatus
  isCurrentUser?: boolean
}

export default function UserCard({ 
  user, 
  isFollowing = false, 
  initialStatus, 
  isCurrentUser 
}: UserCardProps) {
  const [status, setStatus] = useState<ConnectionStatus>('none')
  const [loading, setLoading] = useState(false)
  const [followerCount, setFollowerCount] = useState(user.follower_count)
  const theme = useTheme()
  const cardScale = useSharedValue(1)
  const btnScale = useSharedValue(1)
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }))
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }))

  useEffect(() => {
    if (initialStatus) {
      setStatus(initialStatus)
    } else {
      setStatus(isFollowing ? 'connected' : 'none')
    }
  }, [initialStatus, isFollowing])

  useEffect(() => {
    setFollowerCount(user.follower_count)
  }, [user.follower_count])

  const handleFollow = async () => {
    if (isCurrentUser) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    btnScale.value = withSpring(0.88, { damping: 10 })
    setTimeout(() => { btnScale.value = withSpring(1, { damping: 10 }) }, 100)
    setLoading(true)

    try {
      if (status === 'connected') {
        // Disconnect confirmation
        Alert.alert(
          'Disconnect',
          `Are you sure you want to disconnect from ${user.full_name ?? 'this student'}?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setLoading(false) },
            {
              text: 'Disconnect',
              style: 'destructive',
              onPress: async () => {
                setLoading(true)
                try {
                  setStatus('none')
                  setFollowerCount(c => Math.max(0, c - 1))
                  await unlikeUser(user.id)
                  await unfollowUser(user.id)
                } catch (e) {
                  console.warn(e)
                  setStatus('connected')
                  setFollowerCount(c => c + 1)
                } finally {
                  setLoading(false)
                }
              }
            }
          ]
        )
        return
      } else if (status === 'requested_sent') {
        setStatus('none')
        setFollowerCount(c => Math.max(0, c - 1))
        await unlikeUser(user.id)
        await unfollowUser(user.id)
      } else if (status === 'requested_received') {
        setStatus('connected')
        setFollowerCount(c => c + 1)
        await likeUser(user.id)
        await followUser(user.id)
      } else {
        setStatus('requested_sent')
        setFollowerCount(c => c + 1)
        await likeUser(user.id)
        await followUser(user.id)
      }
    } catch (e) {
      console.warn('[UserCard] follow/connection error:', e)
    } finally {
      setLoading(false)
    }
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
        <View style={[s.accentLine, { backgroundColor: (status === 'connected') ? theme.accent : 'transparent' }]} />

        <View style={[s.avatar, { backgroundColor: theme.card2 }]}>
          {user.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={s.avatarImg} />
          ) : (
            <Text style={s.initials}>{getInitials(user.full_name ?? '??')}</Text>
          )}
        </View>

        <View style={s.info}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <Text style={[s.name, { color: theme.text }]} numberOfLines={1}>{user.full_name ?? 'Student'}</Text>
            <VerifiedBadge type={user.badge_type} customColor={user.badge_color} size={14} />
          </View>
          {user.department ? (
            <Text style={[s.dept, { color: theme.textMuted }]} numberOfLines={1}>
              {user.department}{user.level ? ` · ${user.level}` : ''}
            </Text>
          ) : null}
          <Text style={[s.followers, { color: theme.textFaint }]}>{followerCount ?? 0} followers</Text>
        </View>

        {!isCurrentUser && (
          <Animated.View style={[
            btnStyle,
            s.followBtn,
            (status === 'connected' || status === 'requested_sent')
              ? { backgroundColor: theme.accentBg, borderWidth: 0.5, borderColor: theme.accentBorder }
              : { backgroundColor: theme.accent, shadowColor: theme.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 5 },
          ]}>
            <TouchableOpacity style={s.followBtnInner} onPress={handleFollow} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color={(status === 'connected' || status === 'requested_sent') ? theme.accent : '#fff'} />
              ) : (
                <Text style={[s.followText, (status === 'connected' || status === 'requested_sent') && { color: theme.accent }]}>
                  {status === 'connected' ? 'Connected' : status === 'requested_sent' ? 'Requested' : status === 'requested_received' ? 'Accept' : 'Connect'}
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
