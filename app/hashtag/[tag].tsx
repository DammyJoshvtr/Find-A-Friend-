/**
 * app/hashtag/[tag].tsx
 * Posts for a specific hashtag.
 */
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getHashtagPosts } from '../../lib/feed'
import { useTheme } from '../../lib/theme'
import PostCard from '../../components/feed/PostCard'
import type { FeedPost } from '../../lib/feed'

export default function HashtagScreen() {
  const theme = useTheme()
  const { tag } = useLocalSearchParams<{ tag: string }>()
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [cursor, setCursor] = useState<string | undefined>()
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (tag) loadPosts()
  }, [tag])

  const loadPosts = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await getHashtagPosts(tag, undefined, 20)
      if (err) { setError(err.message); return }
      const results = data ?? []
      setPosts(results)
      setCursor(results.length > 0 ? results[results.length - 1].created_at : undefined)
      setHasMore(results.length === 20)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load posts')
    } finally {
      setLoading(false)
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    setCursor(undefined)
    const { data } = await getHashtagPosts(tag, undefined, 20)
    const results = data ?? []
    setPosts(results)
    setCursor(results.length > 0 ? results[results.length - 1].created_at : undefined)
    setHasMore(results.length === 20)
    setRefreshing(false)
  }, [tag])

  const loadMore = async () => {
    if (loadingMore || !hasMore || !cursor) return
    setLoadingMore(true)
    const { data } = await getHashtagPosts(tag, cursor, 20)
    const results = data ?? []
    setPosts(prev => [...prev, ...results])
    setCursor(results.length > 0 ? results[results.length - 1].created_at : cursor)
    setHasMore(results.length === 20)
    setLoadingMore(false)
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#f0f0ff" />
        </TouchableOpacity>
        <View>
          <Text style={s.tagTitle}>#{tag}</Text>
          <Text style={s.postCount}>{posts.length} post{posts.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color="#a78bfa" />
        </View>
      ) : error ? (
        <View style={s.loadingWrap}>
          <Text style={s.errorText}>Could not load posts</Text>
          <TouchableOpacity style={s.retryBtn} onPress={loadPosts}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <PostCard post={item} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a78bfa" />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color="#a78bfa" style={{ paddingVertical: 16 }} />
            ) : null
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="pricetag-outline" size={40} color="rgba(240,240,255,0.15)" />
              <Text style={s.emptyTitle}>No posts with #{tag}</Text>
            </View>
          }
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1c1c2e',
    alignItems: 'center', justifyContent: 'center',
  },
  tagTitle: { fontSize: 17, fontWeight: '700', color: '#a78bfa' },
  postCount: { fontSize: 11, color: 'rgba(240,240,255,0.4)', marginTop: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: 'rgba(240,240,255,0.4)' },
  retryBtn: {
    backgroundColor: '#a78bfa', borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 8,
  },
  retryText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 15, color: 'rgba(240,240,255,0.4)' },
})
