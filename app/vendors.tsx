/**
 * app/vendors.tsx
 * Campus vendors — list with category filter + "Become a Vendor" CTA.
 */
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, ScrollView,
  TouchableOpacity, TextInput, RefreshControl, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getVendorsWithDeals } from '../lib/vendors'
import { useTheme } from '../lib/theme'
import { typography } from '../lib/typography'
import VendorCard from '../components/vendors/VendorCard'
import { useBadgesStore } from '../store/badgesStore'
import type { VendorWithDeals } from '../lib/vendors'

const CATEGORIES = ['All', 'Food', 'Fashion', 'Tech', 'Beauty', 'Books', 'Health', 'Services']

export default function VendorsScreen() {
  const theme = useTheme()
  const [vendors, setVendors] = useState<VendorWithDeals[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [error, setError] = useState<string | null>(null)
  const markSeen = useBadgesStore(s => s.markSeen)

  useFocusEffect(
    useCallback(() => {
      markSeen('vendors')
    }, [markSeen])
  )

  useEffect(() => { loadVendors() }, [])

  const loadVendors = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await getVendorsWithDeals()
      if (err) {
        setError('Could not load vendors. Pull down to retry.')
      } else {
        setVendors(data ?? [])
      }
    } catch {
      setError('Could not load vendors. Pull down to retry.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadVendors()
  }, [])

  const filtered = vendors.filter(v => {
    const matchSearch = !search || v.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = category === 'All' || v.category === category
    return matchSearch && matchCat
  })

  const totalDeals = filtered.reduce(
    (sum, v) => sum + (v.vendor_deals?.filter(d => d.is_active).length ?? 0), 0
  )

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.border2 }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.text }]}>Campus Deals</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : error ? (
        <View style={s.errorWrap}>
          <Ionicons name="alert-circle-outline" size={40} color={theme.textFaint} />
          <Text style={[s.errorText, { color: theme.textMuted }]}>{error}</Text>
          <TouchableOpacity style={[s.retryBtn, { backgroundColor: theme.accent }]} onPress={loadVendors}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={s.cardWrap}>
              <VendorCard vendor={item} />
            </View>
          )}
          ListHeaderComponent={
            <>
              {/* Search */}
              <View style={[s.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Ionicons name="search-outline" size={15} color={theme.textMuted} />
                <TextInput
                  style={[s.searchInput, { color: theme.text }]}
                  placeholder="Search vendors..."
                  placeholderTextColor={theme.textMuted}
                  value={search}
                  onChangeText={setSearch}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <Ionicons name="close-circle" size={15} color={theme.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Category pills */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.catRow}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      s.catPill,
                      { backgroundColor: theme.card, borderColor: theme.border },
                      category === cat && {
                        backgroundColor: theme.accentBg,
                        borderColor: theme.accentBorder
                      }
                    ]}
                    onPress={() => setCategory(cat)}>
                    <Text style={[
                      s.catText,
                      { color: theme.textMuted },
                      category === cat && {
                        color: theme.accent,
                        fontFamily: typography.fontBold
                      }
                    ]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Stats strip */}
              <View style={[s.statsStrip, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={s.statItem}>
                  <Text style={[s.statValue, { color: theme.accent }]}>{filtered.length}</Text>
                  <Text style={[s.statLabel, { color: theme.textMuted }]}>Vendors</Text>
                </View>
                <View style={[s.statDivider, { backgroundColor: theme.border2 }]} />
                <View style={s.statItem}>
                  <Text style={[s.statValue, { color: theme.accent }]}>{totalDeals}</Text>
                  <Text style={[s.statLabel, { color: theme.textMuted }]}>Active Deals</Text>
                </View>
                <View style={[s.statDivider, { backgroundColor: theme.border2 }]} />
                <TouchableOpacity
                  style={s.statItem}
                  onPress={() => router.push('/vendor-apply' as any)}>
                  <Ionicons name="storefront-outline" size={18} color={theme.accent} />
                  <Text style={[s.statLabel, { color: theme.accent }]}>Become a Vendor</Text>
                </TouchableOpacity>
              </View>

              <Text style={[s.sectionTitle, { color: theme.textMuted }]}>
                {category === 'All' ? 'All Vendors' : category} ({filtered.length})
              </Text>
            </>
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="storefront-outline" size={40} color={theme.textFaint} />
              <Text style={[s.emptyTitle, { color: theme.textMuted }]}>No vendors found</Text>
              {search || category !== 'All'
                ? <Text style={[s.emptySub, { color: theme.textFaint }]}>Try a different search or category</Text>
                : <Text style={[s.emptySub, { color: theme.textFaint }]}>Be the first to list your business</Text>}
              <TouchableOpacity
                style={[s.applyBtn, { backgroundColor: theme.accent }]}
                onPress={() => router.push('/vendor-apply' as any)}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={s.applyBtnText}>Apply as Vendor</Text>
              </TouchableOpacity>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    borderWidth: 0.5,
  },
  title: { fontSize: 18, fontFamily: typography.fontBold },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  errorText: { fontSize: 14, textAlign: 'center', fontFamily: typography.fontRegular },
  retryBtn: { borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  retryText: { fontSize: 13, fontFamily: typography.fontSemiBold, color: '#fff' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12, marginBottom: 10,
    borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 0.5,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: typography.fontRegular },
  catRow: { paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  catPill: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 0.5,
  },
  catText: { fontSize: 12, fontFamily: typography.fontMedium },
  statsStrip: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 16,
    borderRadius: 14, padding: 14,
    borderWidth: 0.5,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 0.5, height: 32 },
  statValue: { fontSize: 20, fontFamily: typography.fontBold },
  statLabel: { fontSize: 10, fontFamily: typography.fontMedium },
  sectionTitle: {
    fontSize: 13, fontFamily: typography.fontSemiBold,
    paddingHorizontal: 16, marginBottom: 8,
  },
  cardWrap: { paddingHorizontal: 16, marginBottom: 8 },
  empty: { alignItems: 'center', paddingTop: 40, paddingBottom: 40, gap: 8 },
  emptyTitle: { fontSize: 15, fontFamily: typography.fontSemiBold },
  emptySub: { fontSize: 12, textAlign: 'center', fontFamily: typography.fontRegular },
  applyBtn: {
    marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, paddingHorizontal: 20, paddingVertical: 9,
  },
  applyBtnText: { fontSize: 13, fontFamily: typography.fontSemiBold, color: '#fff' },
})
