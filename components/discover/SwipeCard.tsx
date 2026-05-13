import React, { forwardRef, useImperativeHandle, useCallback } from 'react'
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  runOnJS, interpolate, Extrapolation,
} from 'react-native-reanimated'
import { router } from 'expo-router'
import { getInitials } from '../../lib/matching'
import { typography } from '../../lib/typography'
import type { FollowProfile } from '../../lib/follows'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
export const CARD_WIDTH = SCREEN_WIDTH - 32
export const CARD_HEIGHT = Math.min(SCREEN_WIDTH * 1.38, 510)
const SWIPE_THRESHOLD = 80

// Module-level constants — must be outside the component so worklets can capture them safely
const CARD_SCALES = [1, 0.95, 0.90]
const CARD_TRANSLATE_YS = [0, 16, 32]
const CARD_OPACITIES = [1, 1, 0.85]

// Gradient color pairs per profile (derived from name)
// [dark-bg, mid, accent, unused]
const GRADIENTS: [string, string][] = [
  ['#1a0533', '#4c1d95'],
  ['#0a1628', '#1e3a8a'],
  ['#051520', '#164e63'],
  ['#031a0e', '#14532d'],
  ['#1a0a00', '#7c2d12'],
  ['#1a0520', '#6b21a8'],
]

export interface SwipeCardRef {
  swipeLeft: () => void
  swipeRight: () => void
}

interface Props {
  user: FollowProfile
  stackIndex: number  // 0 = front, 1 = middle, 2 = back
  isTop: boolean
  onSwipeLeft: () => void
  onSwipeRight: () => void
}

const SwipeCard = forwardRef<SwipeCardRef, Props>(
  ({ user, stackIndex, isTop, onSwipeLeft, onSwipeRight }, ref) => {
    const translateX = useSharedValue(0)
    const translateY = useSharedValue(0)
    const rotation = useSharedValue(0)
    const likeOpacity = useSharedValue(0)
    const nopeOpacity = useSharedValue(0)

    const colorIdx = Math.abs(
      (user?.full_name?.charCodeAt(0) ?? 65) + (user?.full_name?.charCodeAt(2) ?? 66)
    ) % GRADIENTS.length
    const grad = GRADIENTS[colorIdx] ?? GRADIENTS[0]

    useImperativeHandle(ref, () => ({
      swipeLeft: () => {
        translateX.value = withSpring(-620, { velocity: -1800 })
        setTimeout(onSwipeLeft, 280)
      },
      swipeRight: () => {
        translateX.value = withSpring(620, { velocity: 1800 })
        setTimeout(onSwipeRight, 280)
      },
    }), [onSwipeLeft, onSwipeRight])

    const openProfile = useCallback(() => {
      if (user?.id && !user.id.startsWith('demo-')) {
        router.push(`/profile/${user.id}` as any)
      }
    }, [user?.id])

    const tapGesture = Gesture.Tap()
      .enabled(isTop)
      .maxDuration(240)
      .onEnd(() => { runOnJS(openProfile)() })

    const panGesture = Gesture.Pan()
      .enabled(isTop)
      .onUpdate(e => {
        translateX.value = e.translationX
        translateY.value = e.translationY * 0.18
        rotation.value = interpolate(
          e.translationX, [-220, 0, 220], [-14, 0, 14], Extrapolation.CLAMP
        )
        likeOpacity.value = interpolate(
          e.translationX, [20, 100], [0, 1], Extrapolation.CLAMP
        )
        nopeOpacity.value = interpolate(
          e.translationX, [-100, -20], [1, 0], Extrapolation.CLAMP
        )
      })
      .onEnd(e => {
        if (e.translationX > SWIPE_THRESHOLD) {
          translateX.value = withSpring(620, { velocity: e.velocityX })
          runOnJS(onSwipeRight)()
        } else if (e.translationX < -SWIPE_THRESHOLD) {
          translateX.value = withSpring(-620, { velocity: e.velocityX })
          runOnJS(onSwipeLeft)()
        } else {
          translateX.value = withSpring(0, { damping: 14, stiffness: 120 })
          translateY.value = withSpring(0)
          rotation.value = withSpring(0, { damping: 14 })
          likeOpacity.value = withTiming(0, { duration: 150 })
          nopeOpacity.value = withTiming(0, { duration: 150 })
        }
      })

    const cardStyle = useAnimatedStyle(() => {
      if (isTop) {
        return {
          transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { rotate: `${rotation.value}deg` },
          ],
        }
      }
      return {
        transform: [
          { scale: CARD_SCALES[stackIndex] ?? 0.86 },
          { translateY: CARD_TRANSLATE_YS[stackIndex] ?? 48 },
        ],
        opacity: CARD_OPACITIES[stackIndex] ?? 0.7,
      }
    })

    const likeStyle = useAnimatedStyle(() => ({ opacity: likeOpacity.value }))
    const nopeStyle = useAnimatedStyle(() => ({ opacity: nopeOpacity.value }))

    // Race: if finger lifts quickly → tap (navigate to profile); if finger moves → pan (swipe)
    const composed = Gesture.Race(tapGesture, panGesture)

    // Guard: real profiles from DB must always have an id
    if (!user?.id) return null

    const interests = Array.isArray(user.interests) ? user.interests : []

    return (
      <GestureDetector gesture={composed}>
        <Animated.View style={[s.card, cardStyle]}>
          {/* Background: photo or colored gradient */}
          {user.avatar_url ? (
            <Image
              source={{ uri: user.avatar_url }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, s.gradBg, { backgroundColor: grad[1] }]}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: grad[0], opacity: 0.6 }]} />
              <Text style={s.bigInitials}>{getInitials(user.full_name ?? '')}</Text>
            </View>
          )}

          {/* Bottom dark overlay behind text */}
          <View style={s.bottomOverlay} />

          {/* User info */}
          <View style={s.info}>
            <View style={s.nameRow}>
              <Text style={s.name} numberOfLines={1}>{user.full_name ?? 'Student'}</Text>
              <View style={s.verifiedBadge}>
                <Text style={s.verifiedText}>✓ Verified</Text>
              </View>
            </View>
            <Text style={s.dept} numberOfLines={1}>
              {user.department ?? 'Student'}{user.level ? ` · ${user.level}` : ''}
            </Text>
            {interests.length > 0 && (
              <View style={s.tags}>
                {interests.slice(0, 4).map((tag, i) => (
                  <View key={i} style={s.tag}>
                    <Text style={s.tagText}>{String(tag)}</Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={s.followers}>{user.follower_count ?? 0} followers</Text>
          </View>

          {/* LIKE badge */}
          <Animated.View style={[s.likeBadge, likeStyle]}>
            <Text style={s.likeText}>LIKE</Text>
          </Animated.View>

          {/* NOPE badge */}
          <Animated.View style={[s.nopeBadge, nopeStyle]}>
            <Text style={s.nopeText}>NOPE</Text>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    )
  }
)

export default SwipeCard

const s = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 26,
    overflow: 'hidden',
    position: 'absolute',
    backgroundColor: '#0f0f1e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 14,
  },
  gradBg: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: '55%',
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  bigInitials: {
    fontSize: 110,
    fontFamily: typography.fontExtraBold,
    color: 'rgba(255,255,255,0.18)',
    letterSpacing: -6,
    marginTop: -20,
  },
  info: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: 22,
    paddingBottom: 26,
    paddingTop: 12,
  },
  nameRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginBottom: 5,
  },
  name: {
    fontSize: 28, fontFamily: typography.fontBold,
    color: '#fff', flex: 1,
  },
  verifiedBadge: {
    backgroundColor: 'rgba(52,211,153,0.18)',
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 0.5, borderColor: 'rgba(52,211,153,0.45)',
  },
  verifiedText: { fontSize: 10, color: '#34d399', fontFamily: typography.fontSemiBold },
  dept: {
    fontSize: 15, color: 'rgba(255,255,255,0.7)',
    fontFamily: typography.fontRegular, marginBottom: 12,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  tag: {
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5,
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.45)',
  },
  tagText: { fontSize: 12, color: '#c4b5fd', fontFamily: typography.fontMedium },
  followers: {
    fontSize: 12, color: 'rgba(255,255,255,0.45)',
    fontFamily: typography.fontRegular,
  },
  likeBadge: {
    position: 'absolute', top: 34, left: 22,
    borderWidth: 3.5, borderColor: '#4ade80',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7,
    transform: [{ rotate: '-22deg' }],
  },
  likeText: {
    fontSize: 28, fontFamily: typography.fontExtraBold,
    color: '#4ade80', letterSpacing: 3,
  },
  nopeBadge: {
    position: 'absolute', top: 34, right: 22,
    borderWidth: 3.5, borderColor: '#f87171',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7,
    transform: [{ rotate: '22deg' }],
  },
  nopeText: {
    fontSize: 28, fontFamily: typography.fontExtraBold,
    color: '#f87171', letterSpacing: 3,
  },
})
