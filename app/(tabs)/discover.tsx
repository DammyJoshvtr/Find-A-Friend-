import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput, FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getSuggestedUsers } from '../../lib/follows'
import { getTrending } from '../../lib/feed'
import { getLikesCounts } from '../../lib/discoverLikes'
import StudentCard from '../../components/discover/StudentCard'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'
import { showTabBar } from '../../lib/tabBarAnim'
import type { FollowProfile } from '../../lib/follows'
import type { TrendingHashtag } from '../../lib/feed'
import NeuralBackground from '../../components/NeuralBackground'
import ScreenLoader from '../../components/ScreenLoader'
import { supabase } from '../../lib/supabase'
import { useBadgesStore } from '../../store/badgesStore'

export default function DiscoverScreen() {
  const [deck, setDeck] = useState<FollowProfile[]>([])
  const [liked, setLiked] = useState(0)
  const [trending, setTrending] = useState<TrendingHashtag[]>([])
  const [loading, setLoading] = useState(true)
  const [likesCount, setLikesCount] = useState({ received: 0, mutual: 0 })
  const [userProfile, setUserProfile] = useState<FollowProfile | null>(null)
  
  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Same Major' | 'Hobbies' | 'Newbies'>('All')

  const theme = useTheme()
  const markSeen = useBadgesStore(s => s.markSeen)

  useFocusEffect(
    useCallback(() => {
      markSeen('discover')
    }, [markSeen])
  )

  useEffect(() => {
    loadData()
    getLikesCounts().then(setLikesCount)

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) setUserProfile(data)
        })
    })
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [usersRes, trendingRes] = await Promise.all([getSuggestedUsers(), getTrending()])
      setDeck(usersRes.data ?? [])
      setTrending(trendingRes.data ?? [])
    } catch (e) {
      console.warn('[Discover] loadData error:', e)
      setDeck([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!loading) {
      showTabBar()
    }
  }, [loading])

  const handleConnectToggle = (userId: string, isConnecting: boolean) => {
    if (isConnecting) {
      setLiked(n => n + 1)
    } else {
      setLiked(n => Math.max(0, n - 1))
    }
    getLikesCounts().then(setLikesCount)
  }

  const handleReload = () => {
    setLiked(0)
    setSearchQuery('')
    setSelectedCategory('All')
    loadData()
  }

  // Filter and Search logic
  const getFilteredDeck = () => {
    let filtered = deck

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(u => 
        (u.full_name && u.full_name.toLowerCase().includes(q)) ||
        (u.department && u.department.toLowerCase().includes(q)) ||
        (u.interests && u.interests.some(i => i.toLowerCase().includes(q)))
      )
    }

    if (selectedCategory === 'Same Major') {
      if (userProfile?.department) {
        filtered = filtered.filter(u => u.department === userProfile.department)
      } else {
        filtered = []
      }
    } else if (selectedCategory === 'Hobbies') {
      if (userProfile?.interests && userProfile.interests.length > 0) {
        const myInterests = userProfile.interests.map(i => i.toLowerCase())
        filtered = filtered.filter(u => 
          u.interests && u.interests.some(i => myInterests.includes(i.toLowerCase()))
        )
      } else {
        filtered = filtered.filter(u => u.interests && u.interests.length > 0)
      }
    } else if (selectedCategory === 'Newbies') {
      filtered = filtered.filter(u => 
        u.level && (
          u.level.toLowerCase().includes('freshman') || 
          u.level.toLowerCase().includes('first year') || 
          u.level.toLowerCase().includes('1st year') ||
          u.level.toLowerCase().includes('lvl')
        )
      )
    }

    return filtered
  }

  const filteredDeck = getFilteredDeck()
  const remaining = filteredDeck.length

  const categories = [
    { id: 'All', label: 'All Students', icon: 'people-outline' },
    { id: 'Same Major', label: 'Same Major', icon: 'school-outline' },
    { id: 'Hobbies', label: 'Mutual Hobbies', icon: 'ribbon-outline' },
    { id: 'Newbies', label: 'Newbies', icon: 'sparkles-outline' },
  ]

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <NeuralBackground intensity="light" />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={[s.title, { color: theme.text }]}>Discover</Text>
          <Text style={[s.subtitle, { color: theme.textFaint }]}>
            {liked > 0
              ? `${liked} connections made today`
              : remaining > 0
              ? `${remaining} students found`
              : 'Find your people'}
          </Text>
        </View>
        <View style={s.headerBtns}>
          {/* Connections / Requests button */}
          <TouchableOpacity
            style={[s.headerBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => router.push('/discover-likes' as any)}>
            <Ionicons name="person-add-outline" size={18} color={theme.accent} />
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
            onPress={handleReload}>
            <Ionicons name="refresh-outline" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={[s.searchBarContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Ionicons name="search" size={18} color={theme.textMuted} />
        <TextInput
          style={[s.searchInput, { color: theme.text }]}
          placeholder="Search by name, major, or hobbies..."
          placeholderTextColor={theme.textFaint}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={theme.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Tabs */}
      <View style={{ height: 38 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.categoriesContainer}
        >
          {categories.map(cat => {
            const isActive = selectedCategory === cat.id
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  s.categoryPill,
                  isActive
                    ? { backgroundColor: theme.accent, borderColor: theme.accent }
                    : { backgroundColor: theme.card, borderColor: theme.border }
                ]}
                onPress={() => setSelectedCategory(cat.id as any)}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={13}
                  color={isActive ? '#fff' : theme.textMuted}
                />
                <Text style={[
                  s.categoryText,
                  { color: isActive ? '#fff' : theme.text }
                ]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </View>

      {/* Trending chips */}
      {trending.length > 0 && selectedCategory === 'All' && !searchQuery && (
        <View style={{ height: 42, marginTop: 4 }}>
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.trendRow}>
            {trending.slice(0, 10).map(item => (
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
        </View>
      )}

      {/* Student Directory Grid */}
      {loading ? (
        <ScreenLoader message="Loading campus directory..." />
      ) : remaining === 0 ? (
        <View style={s.center}>
          <Text style={s.doneEmoji}>🔍</Text>
          <Text style={[s.emptyTitle, { color: theme.text }]}>No students found</Text>
          <Text style={[s.emptyText, { color: theme.textMuted }]}>
            {selectedCategory === 'Same Major' && !userProfile?.department
              ? "Fill out your profile department to connect with classmates!"
              : selectedCategory === 'Hobbies' && (!userProfile?.interests || userProfile.interests.length === 0)
              ? "Add interests to your profile to find like-minded people!"
              : "Try adjusting your search query or categories."}
          </Text>
          <TouchableOpacity
            style={[s.reloadBtn, { backgroundColor: theme.accent }]}
            onPress={handleReload}>
            <Text style={s.reloadBtnText}>Reset search</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredDeck}
          keyExtractor={item => item.id}
          numColumns={2}
          key={`grid-2`}
          renderItem={({ item }) => (
            <StudentCard
              user={item}
              onConnectToggle={handleConnectToggle}
            />
          )}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
        />
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
  searchBarContainer: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginVertical: 6,
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 0.5, gap: 8,
  },
  searchInput: {
    flex: 1, fontSize: 13, fontFamily: typography.fontRegular,
    padding: 0,
  },
  categoriesContainer: {
    paddingHorizontal: 16, paddingBottom: 6, gap: 8,
  },
  categoryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 16, paddingHorizontal: 12, height: 32,
    borderWidth: 0.5,
  },
  categoryText: { fontSize: 11, fontFamily: typography.fontMedium },
  trendRow: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  trendPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 0.5,
  },
  trendText: { fontSize: 11, fontFamily: typography.fontMedium },
  trendCount: {
    fontSize: 9, fontFamily: typography.fontRegular,
    borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1,
  },
  listContent: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 132,
  },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingHorizontal: 32, paddingVertical: 60,
  },
  doneEmoji: { fontSize: 54 },
  emptyTitle: { fontSize: 18, fontFamily: typography.fontSemiBold, textAlign: 'center' },
  emptyText: { fontSize: 13, fontFamily: typography.fontRegular, textAlign: 'center', lineHeight: 20 },
  reloadBtn: {
    borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10, marginTop: 8,
  },
  reloadBtnText: { fontSize: 13, fontFamily: typography.fontSemiBold, color: '#fff' },
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
