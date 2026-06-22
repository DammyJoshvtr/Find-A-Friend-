/**
 * app/clubs.tsx
 * Clubs list — my clubs (horizontal) + all clubs grid.
 */
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, RefreshControl, ActivityIndicator, Modal, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import Toast from 'react-native-toast-message'
import * as ImagePicker from 'expo-image-picker'
import { getClubs, getMyClubMemberships, createClub, uploadClubCover } from '../lib/clubs'
import { useTheme } from '../lib/theme'
import { typography } from '../lib/typography'
import ClubCard from '../components/clubs/ClubCard'
import { useBadgesStore } from '../store/badgesStore'
import type { Club } from '../lib/clubs'

const CLUB_COLORS = [
  // Purples & violets
  '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#c4b5fd',
  // Blues
  '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#93c5fd',
  // Greens
  '#34d399', '#10b981', '#059669', '#047857', '#6ee7b7',
  // Pinks & reds
  '#f472b6', '#ec4899', '#db2777', '#ef4444', '#fca5a5',
  // Oranges & yellows
  '#fb923c', '#f97316', '#fbbf24', '#f59e0b', '#fde68a',
  // Teals & cyans
  '#22d3ee', '#06b6d4', '#0891b2', '#0e7490', '#67e8f9',
]

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
  const [newCoverUri, setNewCoverUri] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const pickCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission needed', text2: 'Allow photo access.' })
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', allowsEditing: false, quality: 0.8,
    })
    if (!result.canceled) setNewCoverUri(result.assets[0].uri)
  }

  const markSeen = useBadgesStore(s => s.markSeen)

  useFocusEffect(
    useCallback(() => {
      markSeen('clubs_feature')
    }, [markSeen])
  )

  useEffect(() => { loadClubs() }, [])

  const loadClubs = async () => {
    setLoading(true)
    try {
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
    } catch {
      // Non-fatal
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = useCallback(() => { setRefreshing(true); loadClubs() }, [])

  const handleCreate = async () => {
    if (!newName.trim()) {
      Toast.show({ type: 'error', text1: 'Name required', text2: 'Give your club a name.' })
      return
    }
    setCreating(true)
    try {
      let coverUrl: string | undefined
      if (newCoverUri) {
        const { data, error } = await uploadClubCover(newCoverUri)
        if (error) throw error
        coverUrl = data ?? undefined
      }
      const { data, error } = await createClub({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        category: newCategory,
        color: newColor,
      })
      if (error) throw error
      // If we have a cover image, update the club record
      if (coverUrl && data?.id) {
        const { supabase: sb } = await import('../lib/supabase')
        await sb.from('clubs').update({ cover_url: coverUrl }).eq('id', data.id)
      }
      setShowCreate(false)
      setNewName(''); setNewDesc(''); setNewCategory('Tech')
      setNewColor(CLUB_COLORS[0]); setNewCoverUri(null)
      Toast.show({ type: 'success', text1: 'Club created!', text2: data?.name })
      loadClubs()
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Could not create club', text2: err?.message ?? 'Unknown error' })
    } finally {
      setCreating(false)
    }
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
        <TouchableOpacity onPress={() => router.back()} style={[s.backBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.text }]}>Clubs & Societies</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          contentContainerStyle={{ paddingBottom: 40 }}>

          {myClubs.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={[s.sectionTitle, { color: theme.textMuted }]}>My Clubs</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                {myClubs.map(club => <ClubCard key={club.id} club={club} compact />)}
              </ScrollView>
            </View>
          )}

          <View style={[s.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="search-outline" size={15} color={theme.textMuted} />
            <TextInput
              style={[s.searchInput, { color: theme.text }]}
              placeholder="Search clubs..."
              placeholderTextColor={theme.textFaint}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={15} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[
                  s.catPill,
                  { backgroundColor: theme.card, borderColor: theme.border },
                  category === cat && { backgroundColor: theme.accentBg, borderColor: theme.accentBorder }
                ]}
                onPress={() => setCategory(cat)}>
                <Text style={[s.catText, { color: theme.textMuted }, category === cat && { color: theme.accent, fontFamily: typography.fontBold }]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[s.sectionTitle, { color: theme.textMuted }]}>All Clubs ({filtered.length})</Text>

          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="people-outline" size={40} color={theme.textFaint} />
              <Text style={[s.emptyText, { color: theme.textFaint }]}>No clubs found</Text>
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
        <View style={s.modalContainer}>
          <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setShowCreate(false)} />
          <View style={[s.modalSheet, { backgroundColor: theme.cardSolid || theme.card2, borderColor: theme.border }]}>
            <View style={[s.modalHandle, { backgroundColor: theme.border2 }]} />
            <Text style={[s.modalTitle, { color: theme.text }]}>Create a Club</Text>

            {/* Scrollable content so nothing is cut off */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 8 }}>

              {/* Cover image picker */}
              <TouchableOpacity style={[s.coverPicker, newCoverUri && { borderColor: newColor }]} onPress={pickCover}>
                {newCoverUri ? (
                  <>
                    <Image source={{ uri: newCoverUri }} style={s.coverImg} resizeMode="cover" />
                    <View style={s.coverDim}>
                      <Ionicons name="camera-outline" size={18} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 11, marginTop: 3 }}>Change cover</Text>
                    </View>
                  </>
                ) : (
                  <View style={s.coverEmpty}>
                    <Ionicons name="image-outline" size={24} color="rgba(240,240,255,0.2)" />
                    <Text style={{ color: 'rgba(240,240,255,0.3)', fontSize: 11, marginTop: 4 }}>Add cover image (optional)</Text>
                  </View>
                )}
              </TouchableOpacity>

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

              {/* Color palette — 30 colors in a 6-column grid */}
              <Text style={[s.fieldLabel, { color: theme.textMuted }]}>Club colour</Text>
              <View style={s.colorGrid}>
                {CLUB_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setNewColor(c)}
                    style={[
                      s.colorSwatch,
                      { backgroundColor: c },
                      newColor === c && s.colorSwatchActive,
                    ]}>
                    {newColor === c && (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Preview of selected colour */}
              <View style={[s.colorPreview, { backgroundColor: `${newColor}20`, borderColor: newColor }]}>
                <View style={[s.colorPreviewDot, { backgroundColor: newColor }]} />
                <Text style={[s.colorPreviewText, { color: newColor }]}>Selected: {newColor}</Text>
              </View>

            </ScrollView>

            <TouchableOpacity
              style={[s.createBtn, { backgroundColor: newColor }, creating && { opacity: 0.6 }]}
              onPress={handleCreate} disabled={creating}>
              {creating
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.createBtnText}>Create Club</Text>}
            </TouchableOpacity>
          </View>
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
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontFamily: typography.fontBold },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: {
    fontSize: 13, fontFamily: typography.fontSemiBold,
    marginBottom: 10, paddingHorizontal: 16,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8,
    marginHorizontal: 16, marginBottom: 12,
    borderWidth: 0.5,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: typography.fontRegular },
  catRow: { paddingHorizontal: 16, gap: 8, marginBottom: 14 },
  catPill: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 0.5,
  },
  catPillActive: {},
  catText: { fontSize: 12, fontFamily: typography.fontMedium },
  catTextActive: { fontFamily: typography.fontBold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 },
  gridItem: { width: '47%' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 13, fontFamily: typography.fontRegular },

  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: '#a78bfa', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#a78bfa', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 8,
  },

  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40,
    borderWidth: 0.5, borderBottomWidth: 0, maxHeight: '85%',
    width: '100%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: typography.fontBold, marginBottom: 18 },

  fieldLabel: { fontSize: 11, fontFamily: typography.fontSemiBold, letterSpacing: 0.8, marginBottom: 6, textTransform: 'uppercase' },
  fieldInput: {
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: typography.fontRegular,
    borderWidth: 0.5, marginBottom: 14,
  },

  colorGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 10, marginBottom: 12,
  },
  colorSwatch: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2, shadowRadius: 2, elevation: 2,
  },
  colorSwatchActive: {
    borderWidth: 3, borderColor: '#fff',
    transform: [{ scale: 1.1 }],
  },
  colorPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, marginBottom: 16,
  },
  colorPreviewDot: { width: 14, height: 14, borderRadius: 7 },
  colorPreviewText: { fontSize: 12, fontFamily: typography.fontMedium },

  createBtn: {
    borderRadius: 16, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  createBtnText: { fontSize: 15, fontFamily: typography.fontBold, color: '#fff' },

  // Cover image in create modal
  coverPicker: {
    height: 110, borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#1c1c2e', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
  },
  coverImg: { width: '100%', height: '100%' },
  coverDim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
