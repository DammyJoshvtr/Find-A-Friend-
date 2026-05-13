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
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getVendorsWithDeals } from '../lib/vendors'
import { useTheme } from '../lib/theme'
import { typography } from '../lib/typography'
import VendorCard from '../components/vendors/VendorCard'
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

  useEffect(() => { loadVendors() }, [])

  const loadVendors = async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await getVendorsWithDeals()
    if (err) {
      setError('Could not load vendors. Pull down to retry.')
    } else {
      setVendors(data ?? [])
    }
    setLoading(false)
    setRefreshing(false)
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
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#f0f0ff" />
        </TouchableOpacity>
        <Text style={s.title}>Campus Deals</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color="#fbbf24" />
        </View>
      ) : error ? (
        <View style={s.errorWrap}>
          <Ionicons name="alert-circle-outline" size={40} color="rgba(240,240,255,0.2)" />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={loadVendors}>
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
              <View style={s.searchBar}>
                <Ionicons name="search-outline" size={15} color="rgba(240,240,255,0.3)" />
                <TextInput
                  style={s.searchInput}
                  placeholder="Search vendors..."
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

              {/* Category pills */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.catRow}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[s.catPill, category === cat && s.catPillActive]}
                    onPress={() => setCategory(cat)}>
                    <Text style={[s.catText, category === cat && s.catTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Stats strip */}
              <View style={s.statsStrip}>
                <View style={s.statItem}>
                  <Text style={s.statValue}>{filtered.length}</Text>
                  <Text style={s.statLabel}>Vendors</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                  <Text style={s.statValue}>{totalDeals}</Text>
                  <Text style={s.statLabel}>Active Deals</Text>
                </View>
                <View style={s.statDivider} />
                <TouchableOpacity
                  style={s.statItem}
                  onPress={() => router.push('/vendor-apply' as any)}>
                  <Ionicons name="storefront-outline" size={18} color="#fbbf24" />
                  <Text style={[s.statLabel, { color: '#fbbf24' }]}>Become a Vendor</Text>
                </TouchableOpacity>
              </View>

              <Text style={s.sectionTitle}>
                {category === 'All' ? 'All Vendors' : category} ({filtered.length})
              </Text>
            </>
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="storefront-outline" size={40} color="rgba(240,240,255,0.1)" />
              <Text style={s.emptyTitle}>No vendors found</Text>
              {search || category !== 'All'
                ? <Text style={s.emptySub}>Try a different search or category</Text>
                : <Text style={s.emptySub}>Be the first to list your business</Text>}
              <TouchableOpacity
                style={s.applyBtn}
                onPress={() => router.push('/vendor-apply' as any)}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={s.applyBtnText}>Apply as Vendor</Text>
              </TouchableOpacity>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fbbf24" />
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
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1c1c2e', alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontFamily: typography.fontBold, color: '#f0f0ff' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  errorText: { fontSize: 14, color: 'rgba(240,240,255,0.4)', textAlign: 'center', fontFamily: typography.fontRegular },
  retryBtn: { backgroundColor: '#fbbf24', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  retryText: { fontSize: 13, fontFamily: typography.fontSemiBold, color: '#000' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12, marginBottom: 10,
    backgroundColor: '#1c1c2e', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: { flex: 1, fontSize: 13, color: '#f0f0ff', fontFamily: typography.fontRegular },
  catRow: { paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  catPill: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#1c1c2e', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  catPillActive: {
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderColor: 'rgba(251,191,36,0.4)',
  },
  catText: { fontSize: 12, color: 'rgba(240,240,255,0.4)', fontFamily: typography.fontMedium },
  catTextActive: { color: '#fbbf24', fontFamily: typography.fontBold },
  statsStrip: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: '#1c1c2e', borderRadius: 14, padding: 14,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 0.5, height: 32, backgroundColor: 'rgba(255,255,255,0.08)' },
  statValue: { fontSize: 20, fontFamily: typography.fontBold, color: '#fbbf24' },
  statLabel: { fontSize: 10, color: 'rgba(240,240,255,0.35)', fontFamily: typography.fontMedium },
  sectionTitle: {
    fontSize: 13, fontFamily: typography.fontSemiBold, color: 'rgba(240,240,255,0.5)',
    paddingHorizontal: 16, marginBottom: 8,
  },
  cardWrap: { paddingHorizontal: 16, marginBottom: 8 },
  empty: { alignItems: 'center', paddingTop: 40, paddingBottom: 40, gap: 8 },
  emptyTitle: { fontSize: 15, fontFamily: typography.fontSemiBold, color: 'rgba(240,240,255,0.4)' },
  emptySub: { fontSize: 12, color: 'rgba(240,240,255,0.25)', textAlign: 'center', fontFamily: typography.fontRegular },
  applyBtn: {
    marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fbbf24', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 9,
  },
  applyBtnText: { fontSize: 13, fontFamily: typography.fontSemiBold, color: '#000' },
})
