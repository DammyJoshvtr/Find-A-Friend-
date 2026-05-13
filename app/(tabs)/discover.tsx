import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView,
} from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import Toast from 'react-native-toast-message'
import { getSuggestedUsers, followUser } from '../../lib/follows'
import { getTrending } from '../../lib/feed'
import { likeUser, getLikesCounts } from '../../lib/discoverLikes'
import SwipeCard, { CARD_HEIGHT } from '../../components/discover/SwipeCard'
import type { SwipeCardRef } from '../../components/discover/SwipeCard'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'
import type { FollowProfile } from '../../lib/follows'
import type { TrendingHashtag } from '../../lib/feed'

// ─── Demo fallback profiles ───────────────────────────────────────────────────
const DEMO_PROFILES: FollowProfile[] = [
  {
    id: 'demo-1', full_name: 'Ada Okonkwo', department: 'Computer Science',
    level: '300', avatar_url: null, follower_count: 284, following_count: 91,
    interests: ['AI / ML', 'Web Dev', 'Chess', 'Music'],
  },
  {
    id: 'demo-2', full_name: 'Emeka Nwosu', department: 'Electrical Engineering',
    level: '400', avatar_url: null, follower_count: 172, following_count: 63,
    interests: ['Robotics', 'Gaming', 'Photography'],
  },
  {
    id: 'demo-3', full_name: 'Zainab Bello', department: 'Medicine & Surgery',
    level: '500', avatar_url: null, follower_count: 341, following_count: 110,
    interests: ['Healthcare', 'Fitness', 'Poetry', 'Cooking'],
  },
  {
    id: 'demo-4', full_name: 'Chidi Obi', department: 'Business Administration',
    level: '200', avatar_url: null, follower_count: 98, following_count: 54,
    interests: ['Finance', 'Startups', 'Football', 'Movies'],
  },
  {
    id: 'demo-5', full_name: 'Fatima Abubakar', department: 'Architecture',
    level: '400', avatar_url: null, follower_count: 215, following_count: 78,
    interests: ['Design', 'Art', 'Travel', 'Sustainability'],
  },
  {
    id: 'demo-6', full_name: 'Tunde Adeyemi', department: 'Law',
    level: '300', avatar_url: null, follower_count: 133, following_count: 42,
    interests: ['Debate', 'Politics', 'Reading', 'Tennis'],
  },
]

// ─── Action button ────────────────────────────────────────────────────────────
function ActionBtn({ icon, color, bg, onPress, large }: {
  icon: string; color: string; bg: string; onPress: () => void; large?: boolean
}) {
  const scale = useSharedValue(1)
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  const size = large ? 66 : 54
  return (
    <Animated.View style={[
      animStyle,
      {
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: bg, borderWidth: 1.5, borderColor: `${color}40`,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: color, shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4, shadowRadius: 14, elevation: 8,
      },
    ]}>
      <TouchableOpacity
        style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
        onPressIn={() => { scale.value = withSpring(0.86, { damping: 10 }) }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 10 }) }}
        onPress={onPress}
        activeOpacity={1}>
        <Ionicons name={icon as any} size={large ? 30 : 23} color={color} />
      </TouchableOpacity>
    </Animated.View>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function DiscoverScreen() {
  const [deck, setDeck] = useState<FollowProfile[]>([])
  const [liked, setLiked] = useState(0)
  const [trending, setTrending] = useState<TrendingHashtag[]>([])
  const [loading, setLoading] = useState(true)
  const [likesCount, setLikesCount] = useState({ received: 0, mutual: 0 })
  const theme = useTheme()
  const topCardRef = useRef<SwipeCardRef>(null)

  useEffect(() => {
    loadData()
    getLikesCounts().then(setLikesCount)
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [usersRes, trendingRes] = await Promise.all([getSuggestedUsers(), getTrending()])
      const real = usersRes.data ?? []
      const demoIds = new Set(real.map(u => u.id))
      const padded = DEMO_PROFILES.filter(d => !demoIds.has(d.id))
      // Always put real users first; pad with demos only to fill the deck
      setDeck(real.length > 0 ? [...real, ...padded] : padded)
      setTrending(trendingRes.data ?? [])
    } catch (e) {
      console.warn('[Discover] loadData error:', e)
      setDeck(DEMO_PROFILES)
    } finally {
      setLoading(false)
    }
  }

  const handleSwipeRight = useCallback(async () => {
    const top = deck[0]
    if (!top) return
    setDeck(prev => prev.slice(1))
    setLiked(n => n + 1)
    if (!top.id.startsWith('demo-')) {
      await likeUser(top.id)
      const { error: followErr } = await followUser(top.id)
      if (followErr) {
        Toast.show({ type: 'error', text1: 'Could not follow', text2: followErr.message })
      }
      // Refresh likes count
      getLikesCounts().then(setLikesCount)
    }
  }, [deck])

  const handleSwipeLeft = useCallback(() => {
    setDeck(prev => prev.slice(1))
  }, [])

  const handleReload = () => {
    setLiked(0)
    loadData()
  }

  const remaining = deck.length
  const visible = deck.slice(0, 3)
  const visibleReversed = [...visible].reverse()

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={[s.title, { color: theme.text }]}>Discover</Text>
          <Text style={[s.subtitle, { color: theme.textFaint }]}>
            {liked > 0
              ? `${liked} connected · ${remaining} left`
              : remaining > 0
              ? `${remaining} students nearby`
              : 'Find your people'}
          </Text>
        </View>
        <View style={s.headerBtns}>
          {/* Likes / Matches button */}
          <TouchableOpacity
            style={[s.headerBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => router.push('/discover-likes' as any)}>
            <Ionicons name="heart" size={18} color="#f472b6" />
            {(likesCount.received > 0 || likesCount.mutual > 0) && (
              <View style={s.badge}>
                <Text style={s.badgeText}>
                  {likesCount.mutual > 0 ? likesCount.mutual : likesCount.received}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.headerBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => router.push('/search' as any)}>
            <Ionicons name="search-outline" size={18} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.headerBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={handleReload}>
            <Ionicons name="refresh-outline" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Trending chips */}
      {trending.length > 0 && (
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.trendRow}>
          {trending.slice(0, 12).map(item => (
            <TouchableOpacity
              key={item.hashtag_id}
              style={[s.trendPill, { backgroundColor: theme.card, borderColor: theme.accentBorder }]}
              onPress={() => router.push(`/hashtag/${item.hashtags?.tag}` as any)}>
              <Text style={[s.trendText, { color: theme.accent }]}>#{item.hashtags?.tag}</Text>
              <Text style={[s.trendCount, { color: theme.textFaint, backgroundColor: theme.card2 }]}>
                {item.post_count}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Card area */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[s.centerText, { color: theme.textMuted }]}>Finding students...</Text>
        </View>
      ) : deck.length === 0 ? (
        <View style={s.center}>
          <Text style={s.doneEmoji}>🎉</Text>
          <Text style={[s.emptyTitle, { color: theme.text }]}>You've seen everyone!</Text>
          <Text style={[s.emptyText, { color: theme.textMuted }]}>
            {liked > 0 ? `You connected with ${liked} people` : 'Check back later for new students'}
          </Text>
          <TouchableOpacity
            style={[s.reloadBtn, { backgroundColor: theme.accent }]}
            onPress={handleReload}>
            <Text style={s.reloadBtnText}>Start over</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Stack — back-to-front so front card renders on top */}
          <View style={[s.stack, { height: CARD_HEIGHT + 48 }]}>
            {visibleReversed.map((user, revIdx) => {
              const stackIndex = (Math.min(visible.length, 3) - 1) - revIdx
              const isTop = stackIndex === 0
              return (
                <SwipeCard
                  key={user.id}
                  ref={isTop ? topCardRef : undefined}
                  user={user}
                  stackIndex={stackIndex}
                  isTop={isTop}
                  onSwipeLeft={handleSwipeLeft}
                  onSwipeRight={handleSwipeRight}
                />
              )
            })}
          </View>

          {/* Hint text */}
          <Text style={[s.hint, { color: theme.textFaint }]}>
            Swipe right to follow · left to skip
          </Text>

          {/* Action buttons */}
          <View style={s.actions}>
            <ActionBtn
              icon="close"
              color="#f87171"
              bg="rgba(248,113,113,0.1)"
              onPress={() => topCardRef.current?.swipeLeft()}
              large
            />
            <ActionBtn
              icon="star"
              color="#60a5fa"
              bg="rgba(96,165,250,0.1)"
              onPress={() => {
                // Super like — follow and special toast
                topCardRef.current?.swipeRight()
              }}
            />
            <ActionBtn
              icon="heart"
              color="#4ade80"
              bg="rgba(74,222,128,0.1)"
              onPress={() => topCardRef.current?.swipeRight()}
              large
            />
          </View>
        </>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10,
  },
  title: { fontSize: 26, fontFamily: typography.fontBold },
  subtitle: { fontSize: 12, fontFamily: typography.fontRegular, marginTop: 2 },
  headerBtns: { flexDirection: 'row', gap: 8, marginTop: 2 },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', borderWidth: 0.5,
  },

  trendRow: { paddingHorizontal: 16, paddingBottom: 14, gap: 8 },
  trendPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 0.5,
  },
  trendText: { fontSize: 12, fontFamily: typography.fontMedium },
  trendCount: {
    fontSize: 10, fontFamily: typography.fontRegular,
    borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1,
  },

  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingHorizontal: 32,
  },
  centerText: { fontSize: 13, fontFamily: typography.fontRegular },
  doneEmoji: { fontSize: 64 },
  emptyTitle: { fontSize: 20, fontFamily: typography.fontSemiBold, textAlign: 'center' },
  emptyText: { fontSize: 13, fontFamily: typography.fontRegular, textAlign: 'center', lineHeight: 20 },
  reloadBtn: {
    borderRadius: 24, paddingHorizontal: 28, paddingVertical: 12, marginTop: 8,
  },
  reloadBtnText: { fontSize: 14, fontFamily: typography.fontSemiBold, color: '#fff' },

  stack: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  hint: {
    textAlign: 'center', fontSize: 11,
    fontFamily: typography.fontRegular,
    marginTop: 14, marginBottom: 4,
  },
  actions: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 28,
    paddingTop: 16, paddingBottom: 8,
  },

  badge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#f472b6', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9, fontFamily: typography.fontBold, color: '#fff',
  },
})
