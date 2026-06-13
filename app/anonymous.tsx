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
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getAnonymousPosts } from '../lib/anonymous'
import AnonPostCard from '../components/anonymous/AnonPostCard'
import CommentSheet from '../components/feed/CommentSheet'
import type { AnonymousPost } from '../lib/anonymous'
import { useTheme } from '../lib/theme'
import { typography } from '../lib/typography'

export default function AnonymousScreen() {
  const [posts, setPosts] = useState<AnonymousPost[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [cursor, setCursor] = useState<string | undefined>()
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [commentPostId, setCommentPostId] = useState<string | null>(null)
  const theme = useTheme()

  useEffect(() => {
    loadPosts()
    const sub = DeviceEventEmitter.addListener('refresh_anonymous_feed', () => {
      onRefresh()
    })
    return () => sub.remove()
  }, [onRefresh])

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
    const { data } = await getAnonymousPosts(undefined, 20)
    const results = data ?? []
    setPosts(results)
    setCursor(results.length > 0 ? results[results.length - 1].created_at : undefined)
    setHasMore(results.length === 20)
    setRefreshing(false)
  }, [])

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
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
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
  title: { fontSize: 18, fontFamily: typography.fontBold, textAlign: 'center' },
  subtitle: { fontSize: 10, textAlign: 'center', fontFamily: typography.fontRegular },
loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: typography.fontSemiBold, color: '#f0f0ff' },
  emptyText: { fontSize: 13, color: 'rgba(240,240,255,0.4)', fontFamily: typography.fontRegular },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: '#f472b6',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#f472b6', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
})
