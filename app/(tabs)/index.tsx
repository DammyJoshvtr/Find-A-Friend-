import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useFeedStore } from '../../store/feedStore'
import { useNotificationsStore } from '../../store/notificationsStore'
import PostCard from '../../components/feed/PostCard'
import StoriesRow from '../../components/feed/StoriesRow'
import StoryViewer from '../../components/stories/StoryViewer'
import AdCarousel from '../../components/feed/AdCarousel'
import NeuralBackground from '../../components/NeuralBackground'
import ScreenLoader from '../../components/ScreenLoader'
import { getCurrentProfile } from '../../lib/profiles'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'
import { hideTabBar, showTabBar } from '../../lib/tabBarAnim'
import type { FeedPost } from '../../lib/feed'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function HomeScreen() {
  const {
    posts, loading, refreshing, hasMore, error,
    activeTab, loadFeed, refresh, loadMore, setTab,
  } = useFeedStore()

  const { unreadCount, loadUnreadCount } = useNotificationsStore()
  const theme = useTheme()

  const [firstName, setFirstName] = useState<string | null>(null)
  const lastScrollY = useRef(0)

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y
    const dy = y - lastScrollY.current
    lastScrollY.current = y
    if (y < 50) { showTabBar(); return }
    if (dy > 8) hideTabBar()
    else if (dy < -8) showTabBar()
  }, [])

  useEffect(() => {
    loadFeed()
    loadUnreadCount()
    getCurrentProfile().then(profile => {
      if (profile?.full_name) setFirstName(profile.full_name.split(' ')[0])
    })
  }, [loadFeed, loadUnreadCount])

  const handleRefresh = useCallback(() => refresh(), [refresh])
  const handleEndReached = useCallback(() => {
    if (!loading && hasMore) loadMore()
  }, [loading, hasMore, loadMore])

  const renderPost = useCallback(
    ({ item }: { item: FeedPost }) => (
      <PostCard post={item} />
    ), []
  )

  const renderHeader = useCallback(() => activeTab === 'following' ? <View><StoriesRow /></View> : null, [activeTab])

  const renderFooter = useCallback(() =>
    loading && posts.length > 0 ? (
      <ActivityIndicator color={theme.accent} style={{ paddingVertical: 20 }} />
    ) : null,
    [loading, posts.length, theme.accent])

  const renderEmpty = useCallback(() =>
    !loading ? (
      <View style={s.empty}>
        <Ionicons name="newspaper-outline" size={48} color={theme.textFaint} />
        <Text style={[s.emptyTitle, { color: theme.text }]}>Nothing here yet</Text>
        <Text style={[s.emptyText, { color: theme.textMuted }]}>Be the first to post on campus!</Text>
        <TouchableOpacity style={[s.emptyBtn, { backgroundColor: theme.accent }]}
          onPress={() => router.push('/create-post' as any)}>
          <Text style={s.emptyBtnText}>Create first post</Text>
        </TouchableOpacity>
      </View>
    ) : null,
    [loading, theme])

  const header = (
    <View style={[s.header, { borderBottomColor: theme.border }]}>
      <View>
        <Text style={s.logo}>FAF</Text>
        {firstName && (
          <Text style={[s.greeting, { color: theme.textMuted }]}>{getGreeting()}, {firstName} 👋</Text>
        )}
      </View>
      <View style={s.headerRight}>
        <TouchableOpacity
          style={[s.iconBtn, { backgroundColor: theme.card }]}
          onPress={() => router.push('/notifications' as any)}>
          <Ionicons name="notifications-outline" size={20} color={theme.text} />
          {unreadCount > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )

  const proofBanner = <AdCarousel />

  if (loading && !posts.length) {
    return <ScreenLoader message="Loading feed..." />
  }

  if (error && !posts.length) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        <View style={s.loadingWrap}>
          <Ionicons name="alert-circle-outline" size={40} color="rgba(239,68,68,0.6)" />
          <Text style={[s.errorText, { color: theme.textMuted }]}>Failed to load feed</Text>
          <TouchableOpacity style={[s.retryBtn, { backgroundColor: theme.accent }]} onPress={loadFeed}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <NeuralBackground intensity="light" />
      {header}
      {proofBanner}
      <View style={[s.tabs, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={s.tab} onPress={() => setTab('forYou')}>
          {activeTab === 'forYou' ? (
            <View style={[s.tabPill, { backgroundColor: theme.accentBg, borderColor: theme.accentBorder }]}>
              <Text style={[s.tabText, { color: theme.accent, fontWeight: '700' }]}>For You</Text>
            </View>
          ) : (
            <Text style={[s.tabText, { color: theme.textMuted }]}>For You</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={s.tab} onPress={() => setTab('following')}>
          {activeTab === 'following' ? (
            <View style={[s.tabPill, { backgroundColor: theme.accentBg, borderColor: theme.accentBorder }]}>
              <Text style={[s.tabText, { color: theme.accent, fontWeight: '700' }]}>Following</Text>
            </View>
          ) : (
            <Text style={[s.tabText, { color: theme.textMuted }]}>Following</Text>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        keyExtractor={item => item.id}
        renderItem={renderPost}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.listContent}
      />

      <TouchableOpacity
        style={[s.fab, { backgroundColor: theme.accent }]}
        onPress={() => router.push('/create-post' as any)}>
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>

      <StoryViewer />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5,
  },
  logo: { fontSize: 24, fontFamily: typography.fontExtraBold, color: '#a78bfa', letterSpacing: 1 },
  greeting: { fontSize: 12, fontFamily: typography.fontMedium, marginTop: 1 },
  headerRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  badge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, color: '#fff', fontWeight: '700' },
  tabs: { flexDirection: 'row', borderBottomWidth: 0.5 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, position: 'relative' },
  tabText: { fontSize: 12, fontFamily: typography.fontMedium },
  tabPill: {
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 18, paddingVertical: 5,
  },
  listContent: { paddingBottom: 148 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13 },
  errorText: { fontSize: 14, marginTop: 8 },
  retryBtn: { marginTop: 8, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontFamily: typography.fontSemiBold },
  emptyText: { fontSize: 13, textAlign: 'center', fontFamily: typography.fontRegular },
  emptyBtn: { marginTop: 8, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 },
  emptyBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  fab: {
    position: 'absolute', bottom: 108, right: 20,
    width: 54, height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#a78bfa',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55, shadowRadius: 14, elevation: 10,
  },
})
