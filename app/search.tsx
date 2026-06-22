/**
 * app/search.tsx
 * Global search — Users | Posts | Hashtags | Clubs, debounced 300ms.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { searchUsers, searchPosts, searchHashtags, searchClubs } from '../lib/search'
import { useTheme } from '../lib/theme'
import UserCard from '../components/discover/UserCard'
import { getConnectionStatusesBulk } from '../lib/discoverLikes'
import type { ConnectionStatus } from '../lib/discoverLikes'
import PostCard from '../components/feed/PostCard'
import type { FollowProfile } from '../lib/follows'
import type { FeedPost } from '../lib/feed'
import type { Club } from '../lib/clubs'
import type { SearchHashtag } from '../lib/search'

type Tab = 'users' | 'posts' | 'hashtags' | 'clubs'

const TABS: { label: string; value: Tab }[] = [
  { label: 'Users', value: 'users' },
  { label: 'Posts', value: 'posts' },
  { label: 'Hashtags', value: 'hashtags' },
  { label: 'Clubs', value: 'clubs' },
]

export default function SearchScreen() {
  const theme = useTheme()
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('users')
  const [users, setUsers] = useState<FollowProfile[]>([])
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [hashtags, setHashtags] = useState<SearchHashtag[]>([])
  const [clubs, setClubs] = useState<Club[]>([])
  const [statuses, setStatuses] = useState<Record<string, ConnectionStatus>>({})
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setUsers([]); setPosts([]); setHashtags([]); setClubs([])
      setStatuses({})
      return
    }
    setLoading(true)
    try {
      const [uRes, pRes, hRes, cRes] = await Promise.all([
        searchUsers(q),
        searchPosts(q),
        searchHashtags(q),
        searchClubs(q),
      ])
      const usersList = uRes.data ?? []
      setUsers(usersList)
      setPosts(pRes.data ?? [])
      setHashtags(hRes.data ?? [])
      setClubs(cRes.data ?? [])

      if (usersList.length > 0) {
        const statusesMap = await getConnectionStatusesBulk(usersList.map(u => u.id))
        setStatuses(statusesMap)
      } else {
        setStatuses({})
      }
    } catch {
      // Non-fatal — clear results
      setUsers([]); setPosts([]); setHashtags([]); setClubs([])
      setStatuses({})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, doSearch])

  const renderContent = () => {
    if (loading) {
      return <ActivityIndicator color="#a78bfa" style={{ marginTop: 40 }} />
    }
    if (!query.trim()) {
      return (
        <View style={s.emptyWrap}>
          <Ionicons name="search-outline" size={48} color="rgba(240,240,255,0.1)" />
          <Text style={s.emptyText}>Type to search</Text>
        </View>
      )
    }

    switch (activeTab) {
      case 'users':
        return (
          <FlatList
            data={users}
            keyExtractor={i => i.id}
            renderItem={({ item }) => (
              <UserCard 
                user={item} 
                initialStatus={statuses[item.id] || 'none'} 
              />
            )}
            ListEmptyComponent={<EmptyResult query={query} type="users" />}
            scrollEnabled={false}
          />
        )
      case 'posts':
        return (
          <FlatList
            data={posts}
            keyExtractor={i => i.id}
            renderItem={({ item }) => <PostCard post={item} />}
            ListEmptyComponent={<EmptyResult query={query} type="posts" />}
            scrollEnabled={false}
          />
        )
      case 'hashtags':
        return (
          <FlatList
            data={hashtags}
            keyExtractor={i => i.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[s.hashtagRow, { borderBottomColor: theme.border }]}
                onPress={() => router.push(`/hashtag/${item.tag}` as any)}>
                <View style={s.hashtagIcon}>
                  <Ionicons name="pricetag-outline" size={18} color={theme.accent} />
                </View>
                <Text style={[s.hashtagTag, { color: theme.text }]}>#{item.tag}</Text>
                <Ionicons name="chevron-forward" size={14} color={theme.textFaint} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={<EmptyResult query={query} type="hashtags" />}
            scrollEnabled={false}
          />
        )
      case 'clubs':
        return (
          <FlatList
            data={clubs}
            keyExtractor={i => i.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[s.clubRow, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => router.push(`/club/${item.id}` as any)}>
                <View style={[s.clubIcon, { backgroundColor: item.color + '22' }]}>
                  <Ionicons name="people-outline" size={18} color={item.color || theme.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.clubName, { color: theme.text }]}>{item.name}</Text>
                  <Text style={[s.clubMeta, { color: theme.textMuted }]}>{item.category} · {item.member_count} members</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={theme.textFaint} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={<EmptyResult query={query} type="clubs" />}
            scrollEnabled={false}
          />
        )
    }
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
      {/* Search input */}
      <View style={s.searchRow}>
        <TouchableOpacity onPress={() => router.back()} style={[s.backBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <View style={[s.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={16} color={theme.textMuted} />
          <TextInput
            style={[s.searchInput, { color: theme.text }]}
            placeholder="Search..."
            placeholderTextColor={theme.textFaint}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={[s.tabBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.value}
            style={[s.tab, activeTab === tab.value && { backgroundColor: theme.accentBg }]}
            onPress={() => setActiveTab(tab.value)}>
            <Text style={[s.tabText, { color: theme.textMuted }, activeTab === tab.value && { color: theme.accent, fontWeight: '600' }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Results */}
      <FlatList
        data={[1]}
        keyExtractor={() => 'content'}
        renderItem={() => renderContent()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </SafeAreaView>
  )
}

function EmptyResult({ query, type }: { query: string; type: string }) {
  const theme = useTheme()
  return (
    <View style={s.emptyWrap}>
      <Text style={[s.emptyText, { color: theme.textMuted }]}>No {type} matching "{query}"</Text>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 0.5,
  },
  searchInput: { flex: 1, fontSize: 14 },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16, marginBottom: 12,
    borderRadius: 12, padding: 3,
    borderWidth: 0.5,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive: {},
  tabText: { fontSize: 11, fontWeight: '500' },
  tabTextActive: { fontWeight: '600' },
  emptyWrap: { alignItems: 'center', paddingTop: 48, gap: 10 },
  emptyText: { fontSize: 14 },
  hashtagRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  hashtagIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(167,139,250,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  hashtagTag: { flex: 1, fontSize: 14, fontWeight: '500' },
  clubRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginBottom: 8,
    borderRadius: 14, padding: 12,
    borderWidth: 0.5,
  },
  clubIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  clubName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  clubMeta: { fontSize: 11 },
})
