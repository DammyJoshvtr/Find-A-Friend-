/**
 * app/clubs.tsx
 * Clubs list — my clubs (horizontal) + all clubs grid.
 */
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, RefreshControl, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getClubs, getMyClubMemberships } from '../lib/clubs'
import { useTheme } from '../lib/theme'
import ClubCard from '../components/clubs/ClubCard'
import type { Club } from '../lib/clubs'

const CATEGORIES = ['All', 'Tech', 'Arts', 'Sports', 'Academic', 'Social', 'Culture']

export default function ClubsScreen() {
  const theme = useTheme()
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')

  useEffect(() => { loadClubs() }, [])

  const loadClubs = async () => {
    setLoading(true)
    const { data } = await getClubs()
    const rawClubs = data ?? []
    const ids = rawClubs.map(c => c.id)
    const memberships = await getMyClubMemberships(ids)
    const hydrated = rawClubs.map(c => ({
      ...c,
      is_member: memberships.has(c.id),
      user_role: memberships.get(c.id) ?? null,
    }))
    setClubs(hydrated)
    setLoading(false)
    setRefreshing(false)
  }

  const onRefresh = useCallback(() => { setRefreshing(true); loadClubs() }, [])

  const filtered = clubs.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = category === 'All' || c.category.toLowerCase() === category.toLowerCase()
    return matchSearch && matchCat
  })

  const myClubs = clubs.filter(c => c.is_member)

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#f0f0ff" />
        </TouchableOpacity>
        <Text style={s.title}>Clubs & Societies</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color="#a78bfa" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a78bfa" />}
          contentContainerStyle={{ paddingBottom: 40 }}>

          {myClubs.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={s.sectionTitle}>My Clubs</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                {myClubs.map(club => <ClubCard key={club.id} club={club} compact />)}
              </ScrollView>
            </View>
          )}

          <View style={s.searchBar}>
            <Ionicons name="search-outline" size={15} color="rgba(240,240,255,0.3)" />
            <TextInput
              style={s.searchInput}
              placeholder="Search clubs..."
              placeholderTextColor="rgba(240,240,255,0.3)"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={15} color="rgba(240,240,255,0.3)" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity key={cat} style={[s.catPill, category === cat && s.catPillActive]} onPress={() => setCategory(cat)}>
                <Text style={[s.catText, category === cat && s.catTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.sectionTitle}>All Clubs ({filtered.length})</Text>

          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="people-outline" size={40} color="rgba(240,240,255,0.12)" />
              <Text style={s.emptyText}>No clubs found</Text>
            </View>
          ) : (
            <View style={s.grid}>
              {filtered.map(club => (
                <View key={club.id} style={s.gridItem}>
                  <ClubCard club={club} />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1c1c2e', alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#f0f0ff' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: {
    fontSize: 13, fontWeight: '600', color: 'rgba(240,240,255,0.5)',
    marginBottom: 10, paddingHorizontal: 16,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: '#1c1c2e',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: { flex: 1, fontSize: 13, color: '#f0f0ff' },
  catRow: { paddingHorizontal: 16, gap: 8, marginBottom: 14 },
  catPill: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#1c1c2e', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  catPillActive: { backgroundColor: 'rgba(167,139,250,0.15)', borderColor: 'rgba(167,139,250,0.4)' },
  catText: { fontSize: 12, color: 'rgba(240,240,255,0.4)' },
  catTextActive: { color: '#a78bfa', fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 },
  gridItem: { width: '47%' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 13, color: 'rgba(240,240,255,0.3)' },
})
