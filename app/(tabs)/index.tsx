/**
 * app/(tabs)/index.tsx
 * Main social feed screen.
 */
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
import type { FeedPost } from '../../lib/feed'

export default function HomeScreen() {
  const {
    posts,
    loading,
    refreshing,
    hasMore,
    error,
    loadFeed,
    refresh,
    loadMore,
  } = useFeedStore()

  const { unreadCount, loadUnreadCount } = useNotificationsStore()

  const [commentPostId, setCommentPostId] = useState<string | null>(null)

  useEffect(() => {
    loadFeed()
    loadUnreadCount()
  }, [loadFeed, loadUnreadCount])

  const handleRefresh = useCallback(() => {
    refresh()
  }, [refresh])

  const handleEndReached = useCallback(() => {
    if (!loading && hasMore) loadMore()
  }, [loading, hasMore, loadMore])

  const renderPost = useCallback(
    ({ item }: { item: FeedPost }) => (
      <PostCard
        post={item}
        onCommentPress={setCommentPostId}
      />
    ),
    []
  )

  const renderHeader = useCallback(
    () => (
      <View>
        <StoriesRow />
      </View>
    ),
    []
  )

  const renderFooter = useCallback(
    () =>
      loading && posts.length > 0 ? (
        <ActivityIndicator
          color="#a78bfa"
          style={{ paddingVertical: 20 }}
        />
      ) : null,
    [loading, posts.length]
  )

  const renderEmpty = useCallback(
    () =>
      !loading ? (
        <View style={s.empty}>
          <Ionicons name="newspaper-outline" size={48} color="rgba(240,240,255,0.15)" />
          <Text style={s.emptyTitle}>Nothing here yet</Text>
          <Text style={s.emptyText}>Be the first to post on campus!</Text>
          <TouchableOpacity
            style={s.emptyBtn}
            onPress={() => router.push('/create-post' as any)}>
            <Text style={s.emptyBtnText}>Create first post</Text>
          </TouchableOpacity>
        </View>
      ) : null,
    [loading]
  )

  if (loading && !posts.length) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Text style={s.logo}>FAF</Text>
          <View style={s.headerRight}>
            <TouchableOpacity
              style={s.iconBtn}
              onPress={() => router.push('/notifications' as any)}>
              <Ionicons name="notifications-outline" size={20} color="#f0f0ff" />
              {unreadCount > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color="#a78bfa" />
          <Text style={s.loadingText}>Loading feed...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (error && !posts.length) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.loadingWrap}>
          <Ionicons name="alert-circle-outline" size={40} color="rgba(239,68,68,0.6)" />
          <Text style={s.errorText}>Failed to load feed</Text>
          <TouchableOpacity style={s.retryBtn} onPress={loadFeed}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.logo}>FAF</Text>
        <View style={s.headerRight}>
          <TouchableOpacity
            style={s.iconBtn}
            onPress={() => router.push('/notifications' as any)}>
            <Ionicons name="notifications-outline" size={20} color="#f0f0ff" />
            {unreadCount > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
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
            tintColor="#a78bfa"
            colors={['#a78bfa']}
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.listContent}
      />

      {/* FAB */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => router.push('/create-post' as any)}>
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>

      {/* Comment sheet */}
      <CommentSheet
        postId={commentPostId ?? ''}
        visible={!!commentPostId}
        onClose={() => setCommentPostId(null)}
      />

      {/* Story viewer (global overlay) */}
      <StoryViewer />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d14',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  logo: {
    fontSize: 24,
    fontWeight: '800',
    color: '#a78bfa',
    letterSpacing: 1,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1c1c2e',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 80,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: 'rgba(240,240,255,0.4)',
  },
  errorText: {
    fontSize: 14,
    color: 'rgba(240,240,255,0.5)',
    marginTop: 8,
  },
  retryBtn: {
    marginTop: 8,
    backgroundColor: '#a78bfa',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#f0f0ff',
  },
  emptyText: {
    fontSize: 13,
    color: 'rgba(240,240,255,0.4)',
    textAlign: 'center',
  },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: '#a78bfa',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  emptyBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#a78bfa',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#a78bfa',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
})
