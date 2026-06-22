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

interface StudentCardProps {
  user: FollowProfile
  isFollowing?: boolean
  initialStatus?: ConnectionStatus
  onConnectToggle?: (userId: string, isConnecting: boolean) => void
}

export default function StudentCard({ 
  user, 
  isFollowing = false, 
  initialStatus, 
  onConnectToggle 
}: StudentCardProps) {
  const [status, setStatus] = useState<ConnectionStatus>('none')
  const [loading, setLoading] = useState(false)
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

  const handleConnect = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    btnScale.value = withSpring(0.9, { damping: 10 })
    setTimeout(() => { btnScale.value = withSpring(1, { damping: 10 }) }, 100)
    setLoading(true)

    try {
      if (status === 'connected') {
        // Confirm disconnection
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
                  await unlikeUser(user.id)
                  const { error } = await unfollowUser(user.id)
                  if (error) {
                    setStatus('connected')
                  } else if (onConnectToggle) {
                    onConnectToggle(user.id, false)
                  }
                } catch (e) {
                  console.warn(e)
                  setStatus('connected')
                } finally {
                  setLoading(false)
                }
              }
            }
          ]
        )
        return // Return here as Alert.alert uses callbacks
      } else if (status === 'requested_sent') {
        // Cancel request directly
        setStatus('none')
        await unlikeUser(user.id)
        const { error } = await unfollowUser(user.id)
        if (error) {
          setStatus('requested_sent')
        } else if (onConnectToggle) {
          onConnectToggle(user.id, false)
        }
      } else if (status === 'requested_received') {
        // Accept request
        setStatus('connected')
        await likeUser(user.id)
        const { error } = await followUser(user.id)
        if (error) {
          setStatus('requested_received')
        } else if (onConnectToggle) {
          onConnectToggle(user.id, true)
        }
      } else {
        // Send request (none)
        setStatus('requested_sent')
        await likeUser(user.id)
        const { error } = await followUser(user.id)
        if (error) {
          setStatus('none')
        } else if (onConnectToggle) {
          onConnectToggle(user.id, true)
        }
      }
    } catch (e) {
      console.warn('[StudentCard] connection error:', e)
    } finally {
      setLoading(false)
    }
  }

  // Slice interests to show max 2 tags on grid card for cleaner UI
  const interestTags = user.interests ? user.interests.slice(0, 2) : []

  return (
    <Animated.View style={[cardStyle, s.container]}>
      <TouchableOpacity
        style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPressIn={() => { cardScale.value = withSpring(0.97, { damping: 14 }) }}
        onPressOut={() => { cardScale.value = withSpring(1, { damping: 14 }) }}
        onPress={() => router.push(`/profile/${user.id}` as any)}
        activeOpacity={1}>
        
        {/* Avatar Area */}
        <View style={[s.avatar, { backgroundColor: theme.card2, borderColor: theme.accent }]}>
          {user.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={s.avatarImg} />
          ) : (
            <Text style={[s.initials, { color: theme.accent }]}>{getInitials(user.full_name ?? '??')}</Text>
          )}
        </View>

        {/* User Info */}
        <View style={s.info}>
          <View style={s.nameRow}>
            <Text style={[s.name, { color: theme.text }]} numberOfLines={1}>
              {user.full_name ?? 'Student'}
            </Text>
            <VerifiedBadge type={user.badge_type} customColor={user.badge_color} size={13} />
          </View>

          <Text style={[s.dept, { color: theme.textMuted }]} numberOfLines={1}>
            {user.department ?? 'Campus Member'}
          </Text>
          {user.level ? (
            <Text style={[s.level, { color: theme.textMuted }]} numberOfLines={1}>
              {user.level}
            </Text>
          ) : null}
        </View>

        {/* Interest Chips */}
        {interestTags.length > 0 ? (
          <View style={s.interestsContainer}>
            {interestTags.map((interest, idx) => (
              <View key={idx} style={[s.interestPill, { backgroundColor: theme.card2, borderColor: theme.accentBorder }]}>
                <Text style={[s.interestText, { color: theme.accent }]} numberOfLines={1}>
                  #{interest.toLowerCase()}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={s.interestsPlaceholder} />
        )}

        {/* Connect Action Button */}
        <Animated.View style={[
          btnStyle,
          s.connectBtn,
          (status === 'connected' || status === 'requested_sent')
            ? { backgroundColor: theme.accentBg, borderWidth: 0.5, borderColor: theme.accentBorder }
            : { backgroundColor: theme.accent, shadowColor: theme.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
        ]}>
          <TouchableOpacity style={s.connectBtnInner} onPress={handleConnect} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color={(status === 'connected' || status === 'requested_sent') ? theme.accent : '#fff'} />
            ) : (
              <Text style={[s.connectText, (status === 'connected' || status === 'requested_sent') && { color: theme.accent }]}>
                {status === 'connected' ? 'Connected' : status === 'requested_sent' ? 'Requested' : status === 'requested_received' ? 'Accept 👋' : 'Connect 👋'}
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>
        
      </TouchableOpacity>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    padding: 6,
    minWidth: '46%',
  },
  card: {
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    borderWidth: 0.5,
    overflow: 'hidden',
    height: 200,
    justifyContent: 'space-between',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  avatarImg: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  initials: {
    fontSize: 18,
    fontFamily: typography.fontBold,
  },
  info: {
    alignItems: 'center',
    marginTop: 6,
    width: '100%',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    justifyContent: 'center',
    width: '100%',
  },
  name: {
    fontSize: 13,
    fontFamily: typography.fontSemiBold,
    textAlign: 'center',
  },
  dept: {
    fontSize: 10,
    fontFamily: typography.fontRegular,
    textAlign: 'center',
    marginTop: 2,
  },
  level: {
    fontSize: 9,
    fontFamily: typography.fontMedium,
    textAlign: 'center',
    marginTop: 1,
  },
  interestsContainer: {
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginVertical: 4,
  },
  interestPill: {
    borderRadius: 12,
    borderWidth: 0.5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: '48%',
  },
  interestText: {
    fontSize: 9,
    fontFamily: typography.fontMedium,
  },
  interestsPlaceholder: {
    height: 18,
  },
  connectBtn: {
    borderRadius: 16,
    width: '90%',
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: 4,
  },
  connectBtnInner: {
    paddingVertical: 6,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectText: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    color: '#fff',
  },
})
