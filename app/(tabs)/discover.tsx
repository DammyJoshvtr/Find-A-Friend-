/**
 * app/(tabs)/discover.tsx
 * Discover screen — suggested users + trending hashtags.
 */
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
import type { FollowProfile } from '../../lib/follows'
import type { TrendingHashtag } from '../../lib/feed'

export default function DiscoverScreen() {
  const [suggestedUsers, setSuggestedUsers] = useState<FollowProfile[]>([])
  const [trending, setTrending] = useState<TrendingHashtag[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [usersRes, trendingRes] = await Promise.all([
        getSuggestedUsers(),
        getTrending(),
      ])
      setSuggestedUsers(usersRes.data ?? [])
      setTrending(trendingRes.data ?? [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadData()
  }, [])

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Discover</Text>
      </View>

      {/* Search bar — navigates to search screen */}
      <TouchableOpacity
        style={s.searchBar}
        onPress={() => router.push('/search' as any)}
        activeOpacity={0.8}>
        <Ionicons name="search-outline" size={16} color="rgba(240,240,255,0.3)" />
        <Text style={s.searchPlaceholder}>Search users, posts, hashtags, clubs...</Text>
      </TouchableOpacity>

      {loading && !refreshing ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color="#a78bfa" />
        </View>
      ) : error ? (
        <View style={s.loadingWrap}>
          <Text style={s.errorText}>Failed to load</Text>
          <TouchableOpacity style={s.retryBtn} onPress={loadData}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a78bfa" />
          }
          contentContainerStyle={{ paddingBottom: 40 }}>

          {/* Trending hashtags */}
          {trending.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Trending</Text>
              <ScrollView
                horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.hashtagsRow}>
                {trending.slice(0, 12).map((item) => (
                  <TouchableOpacity
                    key={item.hashtag_id}
                    style={s.hashtagPill}
                    onPress={() => router.push(`/hashtag/${item.hashtags?.tag}` as any)}>
                    <Text style={s.hashtagText}>#{item.hashtags?.tag}</Text>
                    <Text style={s.hashtagCount}>{item.post_count}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Suggested users */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Suggested for you</Text>
            {suggestedUsers.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="people-outline" size={36} color="rgba(240,240,255,0.12)" />
                <Text style={s.emptyText}>No suggestions yet</Text>
              </View>
            ) : (
              suggestedUsers.map(user => (
                <UserCard key={user.id} user={user} />
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d14' },
  header: { paddingHorizontal: 16, paddingVertical: 10 },
  title: { fontSize: 22, fontWeight: '700', color: '#f0f0ff' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: '#1c1c2e',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  searchPlaceholder: { fontSize: 13, color: 'rgba(240,240,255,0.3)' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: 'rgba(240,240,255,0.4)' },
  retryBtn: {
    backgroundColor: '#a78bfa', borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 8,
  },
  retryText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13, fontWeight: '600',
    color: 'rgba(240,240,255,0.5)',
    paddingHorizontal: 16, marginBottom: 10,
  },
  hashtagsRow: { paddingHorizontal: 16, gap: 8 },
  hashtagPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1c1c2e',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.2)',
  },
  hashtagText: { fontSize: 13, color: '#a78bfa', fontWeight: '500' },
  hashtagCount: {
    fontSize: 10, color: 'rgba(240,240,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1,
  },
  empty: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyText: { fontSize: 13, color: 'rgba(240,240,255,0.3)' },
})
