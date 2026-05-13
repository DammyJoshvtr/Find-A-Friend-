/**
 * app/clubs.tsx
 * Clubs list — my clubs (horizontal) + all clubs grid.
 */
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, RefreshControl, ActivityIndicator, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import Toast from 'react-native-toast-message'
import { getClubs, getMyClubMemberships, createClub } from '../lib/clubs'
import { useTheme } from '../lib/theme'
import { typography } from '../lib/typography'
import ClubCard from '../components/clubs/ClubCard'
import type { Club } from '../lib/clubs'

const CLUB_COLORS = ['#a78bfa', '#60a5fa', '#34d399', '#f472b6', '#fb923c', '#fbbf24']
const CLUB_ICONS  = ['🎓', '💻', '🎨', '⚽', '🎵', '📚', '🌍', '🔬', '🎭', '🏛️']

const CATEGORIES = ['All', 'Tech', 'Arts', 'Sports', 'Academic', 'Social', 'Culture']

export default function ClubsScreen() {
  const theme = useTheme()
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')

  // Create club modal
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newCategory, setNewCategory] = useState('Tech')
  const [newColor, setNewColor] = useState(CLUB_COLORS[0])
  const [newIcon, setNewIcon] = useState(CLUB_ICONS[0])
  const [creating, setCreating] = useState(false)

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

  const handleCreate = async () => {
    if (!newName.trim()) {
      Toast.show({ type: 'error', text1: 'Name required', text2: 'Give your club a name.' })
      return
    }
    setCreating(true)
    const { data, error } = await createClub({
      name: newName.trim(),
      description: newDesc.trim() || undefined,
      category: newCategory,
      color: newColor,
      icon: newIcon,
    })
    setCreating(false)
    if (error) {
      Toast.show({ type: 'error', text1: 'Could not create club', text2: error.message })
      return
    }
    setShowCreate(false)
    setNewName(''); setNewDesc(''); setNewCategory('Tech')
    setNewColor(CLUB_COLORS[0]); setNewIcon(CLUB_ICONS[0])
    Toast.show({ type: 'success', text1: 'Club created!', text2: data?.name })
    loadClubs()
  }

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

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)}>
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>

      {/* Create Club Modal */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setShowCreate(false)} />
        <View style={[s.modalSheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[s.modalHandle, { backgroundColor: theme.border2 }]} />
          <Text style={[s.modalTitle, { color: theme.text }]}>Create a Club</Text>

          <Text style={[s.fieldLabel, { color: theme.textMuted }]}>Club name *</Text>
          <TextInput
            style={[s.fieldInput, { backgroundColor: theme.card2, borderColor: theme.border, color: theme.text }]}
            placeholder="e.g. Python Coders"
            placeholderTextColor={theme.textFaint}
            value={newName} onChangeText={setNewName}
          />

          <Text style={[s.fieldLabel, { color: theme.textMuted }]}>Description</Text>
          <TextInput
            style={[s.fieldInput, { backgroundColor: theme.card2, borderColor: theme.border, color: theme.text, height: 72 }]}
            placeholder="What is this club about?"
            placeholderTextColor={theme.textFaint}
            value={newDesc} onChangeText={setNewDesc}
            multiline
          />

          <Text style={[s.fieldLabel, { color: theme.textMuted }]}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {CATEGORIES.slice(1).map(cat => (
              <TouchableOpacity
                key={cat}
                style={[s.catPill, newCategory === cat && s.catPillActive, { marginLeft: 0, marginRight: 8 }]}
                onPress={() => setNewCategory(cat)}>
                <Text style={[s.catText, newCategory === cat && s.catTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[s.fieldLabel, { color: theme.textMuted }]}>Color</Text>
          <View style={s.colorRow}>
            {CLUB_COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[s.colorDot, { backgroundColor: c }, newColor === c && s.colorDotActive]}
                onPress={() => setNewColor(c)} />
            ))}
          </View>

          <Text style={[s.fieldLabel, { color: theme.textMuted }]}>Icon</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            {CLUB_ICONS.map(icon => (
              <TouchableOpacity
                key={icon}
                style={[s.iconBtn, { backgroundColor: theme.card2 }, newIcon === icon && { borderColor: newColor, borderWidth: 2 }]}
                onPress={() => setNewIcon(icon)}>
                <Text style={{ fontSize: 22 }}>{icon}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[s.createBtn, { backgroundColor: newColor }, creating && { opacity: 0.6 }]}
            onPress={handleCreate} disabled={creating}>
            {creating
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.createBtnText}>Create Club</Text>}
          </TouchableOpacity>
        </View>
      </Modal>
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
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1c1c2e', alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontFamily: typography.fontBold, color: '#f0f0ff' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: {
    fontSize: 13, fontFamily: typography.fontSemiBold, color: 'rgba(240,240,255,0.5)',
    marginBottom: 10, paddingHorizontal: 16,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: '#1c1c2e',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: { flex: 1, fontSize: 13, color: '#f0f0ff', fontFamily: typography.fontRegular },
  catRow: { paddingHorizontal: 16, gap: 8, marginBottom: 14 },
  catPill: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#1c1c2e', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  catPillActive: { backgroundColor: 'rgba(167,139,250,0.15)', borderColor: 'rgba(167,139,250,0.4)' },
  catText: { fontSize: 12, color: 'rgba(240,240,255,0.4)', fontFamily: typography.fontMedium },
  catTextActive: { color: '#a78bfa', fontFamily: typography.fontBold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 },
  gridItem: { width: '47%' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 13, color: 'rgba(240,240,255,0.3)', fontFamily: typography.fontRegular },

  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: '#a78bfa', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#a78bfa', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 8,
  },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40,
    borderWidth: 0.5, borderBottomWidth: 0, maxHeight: '85%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: typography.fontBold, marginBottom: 18 },

  fieldLabel: { fontSize: 11, fontFamily: typography.fontSemiBold, letterSpacing: 0.8, marginBottom: 6, textTransform: 'uppercase' },
  fieldInput: {
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: typography.fontRegular,
    borderWidth: 0.5, marginBottom: 14,
  },

  colorRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  colorDotActive: { borderWidth: 3, borderColor: '#fff' },

  iconBtn: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 8, borderWidth: 1, borderColor: 'transparent',
  },

  createBtn: {
    borderRadius: 16, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  createBtnText: { fontSize: 15, fontFamily: typography.fontBold, color: '#fff' },
})
