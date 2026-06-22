/**
 * app/anonymous.tsx
 * Anonymous / confessions feed.
 */
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, DeviceEventEmitter
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getAnonymousPosts } from '../lib/anonymous'
import AnonPostCard from '../components/anonymous/AnonPostCard'
import CommentSheet from '../components/feed/CommentSheet'
import type { AnonymousPost } from '../lib/anonymous'
import { useTheme } from '../lib/theme'
import { typography } from '../lib/typography'
import { useBadgesStore } from '../store/badgesStore'
import { getCurrentProfile } from '../lib/profiles'
import type { Profile } from '../lib/profiles'
import { supabase } from '../lib/supabase'
import type { Event } from '../lib/events'

export default function AnonymousScreen() {
  const [posts, setPosts] = useState<AnonymousPost[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [cursor, setCursor] = useState<string | undefined>()
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [commentPostId, setCommentPostId] = useState<string | null>(null)
  const theme = useTheme()
  const markSeen = useBadgesStore(s => s.markSeen)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [boardStatus, setBoardStatus] = useState<'open' | 'closed'>('open')
  const [linkedEvents, setLinkedEvents] = useState<Event[]>([])

  const loadProfileAndStatus = async () => {
    try {
      const p = await getCurrentProfile()
      setProfile(p)

      // Fetch board status
      const { data: statusData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'anonymous_board_status')
        .maybeSingle()
      if (statusData?.value) {
        setBoardStatus(statusData.value as 'open' | 'closed')
      } else {
        setBoardStatus('open')
      }

      // Fetch linked events
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .eq('is_anonymous_linked', true)
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
      setLinkedEvents((eventsData as Event[]) ?? [])
    } catch (e) {
      console.warn('Error loading status or events:', e)
    }
  }

  useFocusEffect(
    useCallback(() => {
      markSeen('anonymous')
    }, [markSeen])
  )

  const loadPosts = async () => {
    setLoading(true)
    try {
      const { data } = await getAnonymousPosts(undefined, 20)
      const results = data ?? []
      setPosts(results)
      setCursor(results.length > 0 ? results[results.length - 1].created_at : undefined)
      setHasMore(results.length === 20)
    } catch {
      // Non-fatal
    } finally {
      setLoading(false)
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      // Refresh status and events
      const { data: statusData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'anonymous_board_status')
        .maybeSingle()
      if (statusData?.value) {
        setBoardStatus(statusData.value as 'open' | 'closed')
      }

      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .eq('is_anonymous_linked', true)
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
      setLinkedEvents((eventsData as Event[]) ?? [])
    } catch (e) {
      // ignore
    }

    const { data } = await getAnonymousPosts(undefined, 20)
    const results = data ?? []
    setPosts(results)
    setCursor(results.length > 0 ? results[results.length - 1].created_at : undefined)
    setHasMore(results.length === 20)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    loadProfileAndStatus()
    loadPosts()
    const sub = DeviceEventEmitter.addListener('refresh_anonymous_feed', () => {
      onRefresh()
    })
    return () => sub.remove()
  }, [onRefresh])

  const loadMore = async () => {
    if (loadingMore || !hasMore || !cursor) return
    setLoadingMore(true)
    const { data } = await getAnonymousPosts(cursor, 20)
    const results = data ?? []
    setPosts(prev => [...prev, ...results])
    setCursor(results.length > 0 ? results[results.length - 1].created_at : cursor)
    setHasMore(results.length === 20)
    setLoadingMore(false)
  }

  const renderEventsHeader = () => {
    if (linkedEvents.length === 0) return null
    return (
      <View style={s.eventsSection}>
        <View style={s.eventsHeader}>
          <Ionicons name="calendar-outline" size={16} color="#f472b6" />
          <Text style={[s.eventsTitle, { color: theme.text }]}>Featured Events</Text>
        </View>
        <FlatList
          data={linkedEvents}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.eventCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => router.push(`/event/${item.id}` as any)}
              activeOpacity={0.85}>
              <View style={s.eventCardHeader}>
                <Text style={s.eventDate}>
                  {new Date(item.starts_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                </Text>
                <View style={s.eventBadge}>
                  <Text style={s.eventBadgeText}>CONFESSION</Text>
                </View>
              </View>
              <Text style={[s.eventTitle, { color: theme.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[s.eventVenue, { color: theme.textMuted }]} numberOfLines={1}>
                📍 {item.venue ?? 'Campus'}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
        />
      </View>
    )
  }

  if (!loading && boardStatus === 'closed' && profile?.role !== 'admin') {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={[s.backBtn, { backgroundColor: theme.card }]}>
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <View>
            <Text style={[s.title, { color: theme.text }]}>Anonymous</Text>
            <Text style={[s.subtitle, { color: theme.textMuted }]}>Campus confessions board</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        <View style={s.closedContainer}>
          <Ionicons name="lock-closed" size={72} color="#f472b6" />
          <Text style={[s.closedTitle, { color: theme.text }]}>Confession Board Closed</Text>
          <Text style={[s.closedText, { color: theme.textMuted }]}>
            The anonymous confession board is currently closed by the administrators. Please check back later.
          </Text>
          <TouchableOpacity style={[s.backToFeedBtn, { backgroundColor: theme.accent }]} onPress={() => router.back()}>
            <Text style={s.backToFeedText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[s.backBtn, { backgroundColor: theme.card }]}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <View>
          <Text style={[s.title, { color: theme.text }]}>Anonymous</Text>
          <Text style={[s.subtitle, { color: theme.textMuted }]}>Campus confessions board</Text>
        </View>
        {profile?.role === 'admin' ? (
          <TouchableOpacity
            onPress={() => router.push('/anonymous-admin' as any)}
            style={[s.adminBtn, { backgroundColor: theme.card }]}>
            <Ionicons name="settings" size={20} color="#a78bfa" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      {boardStatus === 'closed' && (
        <View style={s.adminBanner}>
          <Ionicons name="alert-circle" size={16} color="#fff" />
          <Text style={s.adminBannerText}>Board is CLOSED to students (Admin Preview Mode)</Text>
        </View>
      )}

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          ListHeaderComponent={renderEventsHeader}
          renderItem={({ item }) => (
            <AnonPostCard post={item} onCommentPress={setCommentPostId} />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={theme.accent} style={{ paddingVertical: 16 }} />
            ) : null
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="eye-off-outline" size={48} color={theme.textFaint} />
              <Text style={[s.emptyTitle, { color: theme.text }]}>No anonymous posts yet</Text>
              <Text style={[s.emptyText, { color: theme.textMuted }]}>Be the first to post anonymously</Text>
            </View>
          }
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => router.push('/create-anonymous-post' as any)}>
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>

      <CommentSheet
        postId={commentPostId ?? ''}
        visible={!!commentPostId}
        onClose={() => setCommentPostId(null)}
        isAnonymousPost={true}
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  adminBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)',
  },
  title: { fontSize: 18, fontFamily: typography.fontBold, textAlign: 'center' },
  subtitle: { fontSize: 10, textAlign: 'center', fontFamily: typography.fontRegular },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: typography.fontSemiBold },
  emptyText: { fontSize: 13, fontFamily: typography.fontRegular },
  fab: {
    position: 'absolute', bottom: 96, right: 20,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: '#f472b6',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#f472b6', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  eventsSection: {
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  eventsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  eventsTitle: {
    fontSize: 13,
    fontFamily: typography.fontBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eventCard: {
    width: 200,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  eventCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventDate: {
    fontSize: 11,
    fontFamily: typography.fontBold,
    color: '#f472b6',
  },
  eventBadge: {
    backgroundColor: 'rgba(244,114,182,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  eventBadgeText: {
    fontSize: 7,
    fontFamily: typography.fontBold,
    color: '#f472b6',
  },
  eventTitle: {
    fontSize: 13,
    fontFamily: typography.fontSemiBold,
  },
  eventVenue: {
    fontSize: 10,
    fontFamily: typography.fontRegular,
  },
  closedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  closedTitle: {
    fontSize: 20,
    fontFamily: typography.fontBold,
    textAlign: 'center',
  },
  closedText: {
    fontSize: 14,
    fontFamily: typography.fontRegular,
    textAlign: 'center',
    lineHeight: 20,
  },
  backToFeedBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 8,
  },
  backToFeedText: {
    color: '#fff',
    fontFamily: typography.fontBold,
    fontSize: 13,
  },
  adminBanner: {
    backgroundColor: '#6d28d9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  adminBannerText: {
    color: '#fff',
    fontFamily: typography.fontSemiBold,
    fontSize: 11,
  },
})
