import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getSuggestedUsers } from '../../lib/follows'
import { getTrending } from '../../lib/feed'
import UserCard from '../../components/discover/UserCard'
import { useTheme } from '../../lib/theme'
import type { FollowProfile } from '../../lib/follows'
import type { TrendingHashtag } from '../../lib/feed'

export default function DiscoverScreen() {
  const [suggestedUsers, setSuggestedUsers] = useState<FollowProfile[]>([])
  const [trending, setTrending] = useState<TrendingHashtag[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const theme = useTheme()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [usersRes, trendingRes] = await Promise.all([getSuggestedUsers(), getTrending()])
      setSuggestedUsers(usersRes.data ?? [])
      setTrending(trendingRes.data ?? [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = useCallback(() => { setRefreshing(true); loadData() }, [loadData])

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={s.header}>
        <Text style={[s.title, { color: theme.text }]}>Discover</Text>
      </View>

      <TouchableOpacity
        style={[s.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => router.push('/search' as any)}
        activeOpacity={0.8}>
        <Ionicons name="search-outline" size={16} color={theme.textFaint} />
        <Text style={[s.searchPlaceholder, { color: theme.textFaint }]}>Search users, posts, hashtags, clubs...</Text>
      </TouchableOpacity>

      {loading && !refreshing ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : error ? (
        <View style={s.loadingWrap}>
          <Text style={[s.errorText, { color: theme.textMuted }]}>Failed to load</Text>
          <TouchableOpacity style={[s.retryBtn, { backgroundColor: theme.accent }]} onPress={loadData}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          contentContainerStyle={{ paddingBottom: 40 }}>

          {trending.length > 0 && (
            <View style={s.section}>
              <Text style={[s.sectionTitle, { color: theme.textMuted }]}>Trending</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.hashtagsRow}>
                {trending.slice(0, 12).map(item => (
                  <TouchableOpacity
                    key={item.hashtag_id}
                    style={[s.hashtagPill, { backgroundColor: theme.card, borderColor: theme.accentBorder }]}
                    onPress={() => router.push(`/hashtag/${item.hashtags?.tag}` as any)}>
                    <Text style={[s.hashtagText, { color: theme.accent }]}>#{item.hashtags?.tag}</Text>
                    <Text style={[s.hashtagCount, { color: theme.textFaint, backgroundColor: theme.card2 }]}>
                      {item.post_count}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: theme.textMuted }]}>Suggested for you</Text>
            {suggestedUsers.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="people-outline" size={36} color={theme.textFaint} />
                <Text style={[s.emptyText, { color: theme.textFaint }]}>No suggestions yet</Text>
              </View>
            ) : (
              suggestedUsers.map(user => <UserCard key={user.id} user={user} />)
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 10 },
  title: { fontSize: 22, fontWeight: '700' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 16,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 0.5,
  },
  searchPlaceholder: { fontSize: 13 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14 },
  retryBtn: { borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  retryText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '600', paddingHorizontal: 16, marginBottom: 10 },
  hashtagsRow: { paddingHorizontal: 16, gap: 8 },
  hashtagPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 0.5,
  },
  hashtagText: { fontSize: 13, fontWeight: '500' },
  hashtagCount: { fontSize: 10, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  empty: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyText: { fontSize: 13 },
})
