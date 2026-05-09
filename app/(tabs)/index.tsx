import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useFeedStore } from '../../store/feedStore'
import { useNotificationsStore } from '../../store/notificationsStore'
import PostCard from '../../components/feed/PostCard'
import StoriesRow from '../../components/feed/StoriesRow'
import CommentSheet from '../../components/feed/CommentSheet'
import StoryViewer from '../../components/stories/StoryViewer'
import AdCarousel from '../../components/feed/AdCarousel'
import { getCurrentProfile } from '../../lib/profiles'
import { useTheme } from '../../lib/theme'
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

  const [commentPostId, setCommentPostId] = useState<string | null>(null)
  const [firstName, setFirstName] = useState<string | null>(null)

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
      <PostCard post={item} onCommentPress={setCommentPostId} />
    ), []
  )

  const renderHeader = useCallback(() => <View><StoriesRow /></View>, [])

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
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        {header}
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[s.loadingText, { color: theme.textMuted }]}>Loading feed...</Text>
        </View>
      </SafeAreaView>
    )
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
      {header}
      {proofBanner}
      <View style={[s.tabs, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={s.tab} onPress={() => setTab('forYou')}>
          <Text style={[s.tabText, { color: theme.textMuted }, activeTab === 'forYou' && { color: theme.text, fontWeight: '700' }]}>
            For You
          </Text>
          {activeTab === 'forYou' && <View style={[s.tabIndicator, { backgroundColor: theme.accent }]} />}
        </TouchableOpacity>
        <TouchableOpacity style={s.tab} onPress={() => setTab('following')}>
          <Text style={[s.tabText, { color: theme.textMuted }, activeTab === 'following' && { color: theme.text, fontWeight: '700' }]}>
            Following
          </Text>
          {activeTab === 'following' && <View style={[s.tabIndicator, { backgroundColor: theme.accent }]} />}
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.listContent}
      />

      <TouchableOpacity
        style={[s.fab, { backgroundColor: theme.accent }]}
        onPress={() => router.push('/create-post' as any)}>
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>

      <CommentSheet
        postId={commentPostId ?? ''}
        visible={!!commentPostId}
        onClose={() => setCommentPostId(null)}
      />

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
  logo: { fontSize: 24, fontWeight: '800', color: '#a78bfa', letterSpacing: 1 },
  greeting: { fontSize: 12, marginTop: 1 },
  headerRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  badge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, color: '#fff', fontWeight: '700' },
  tabs: { flexDirection: 'row', borderBottomWidth: 0.5 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 14, position: 'relative' },
  tabText: { fontSize: 15, fontWeight: '500' },
  tabIndicator: {
    position: 'absolute', bottom: 0, left: '25%', right: '25%',
    height: 3, borderRadius: 2,
  },
  listContent: { paddingBottom: 80 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13 },
  errorText: { fontSize: 14, marginTop: 8 },
  retryBtn: { marginTop: 8, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '600' },
  emptyText: { fontSize: 13, textAlign: 'center' },
  emptyBtn: { marginTop: 8, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 },
  emptyBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 54, height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
})
