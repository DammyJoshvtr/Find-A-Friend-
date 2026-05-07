/**
 * app/vendor/[id].tsx
 * Vendor detail — logo, info, active deals list.
 */
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getVendorDetail, toggleSaveDeal, getMySavedDealIds } from '../../lib/vendors'
import { useTheme } from '../../lib/theme'
import type { VendorWithDeals, VendorDeal } from '../../lib/vendors'
import { getTimeAgo } from '../../lib/matching'

const CATEGORY_COLORS: Record<string, string> = {
  Food: '#fbbf24',
  Fashion: '#f472b6',
  Tech: '#60a5fa',
  Beauty: '#c084fc',
  Books: '#34d399',
  Health: '#4ade80',
  Services: '#a78bfa',
}

// ---------------------------------------------------------------------------
// Deal card
// ---------------------------------------------------------------------------

interface DealCardProps {
  deal: VendorDeal
  saved: boolean
  onToggleSave: (id: string) => void
}

function DealCard({ deal, saved, onToggleSave }: DealCardProps) {
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    onToggleSave(deal.id)
    const { error } = await toggleSaveDeal(deal.id)
    setSaving(false)
    if (error) {
      onToggleSave(deal.id) // revert on error
      Alert.alert('Error', 'Could not save deal.')
    }
  }

  const isExpired = deal.valid_until ? new Date(deal.valid_until) < new Date() : false

  return (
    <View style={[s.dealCard, isExpired && s.dealCardExpired]}>
      <View style={s.discountBadge}>
        <Text style={s.discountText}>{deal.discount}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.dealTitle}>{deal.title}</Text>
        {deal.description && (
          <Text style={s.dealDesc} numberOfLines={2}>{deal.description}</Text>
        )}
        <View style={s.dealMeta}>
          <Ionicons name="information-circle-outline" size={11} color="rgba(240,240,255,0.35)" />
          <Text style={s.redeemText}>{deal.how_to_redeem}</Text>
        </View>
        {deal.valid_until && (
          <Text style={[s.validUntil, isExpired && s.expired]}>
            {isExpired ? 'Expired' : `Valid until ${new Date(deal.valid_until).toLocaleDateString()}`}
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={s.saveBtn}
        onPress={handleSave}
        disabled={saving}>
        {saving
          ? <ActivityIndicator size="small" color="#fbbf24" />
          : <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={saved ? '#fbbf24' : 'rgba(240,240,255,0.4)'}
            />}
      </TouchableOpacity>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function VendorDetailScreen() {
  const theme = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [vendor, setVendor] = useState<VendorWithDeals | null>(null)
  const [loading, setLoading] = useState(true)
  const [savedDealIds, setSavedDealIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (id) loadVendor()
  }, [id])

  const loadVendor = async () => {
    setLoading(true)
    const [vendorRes, savedIds] = await Promise.all([
      getVendorDetail(id),
      getMySavedDealIds(),
    ])
    setVendor(vendorRes.data)
    setSavedDealIds(savedIds)
    setLoading(false)
  }

  const handleToggleSave = (dealId: string) => {
    setSavedDealIds(prev => {
      const next = new Set(prev)
      if (next.has(dealId)) next.delete(dealId)
      else next.add(dealId)
      return next
    })
  }

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        <View style={s.centeredWrap}>
          <ActivityIndicator size="large" color="#fbbf24" />
        </View>
      </SafeAreaView>
    )
  }

  if (!vendor) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        <View style={s.centeredWrap}>
          <Text style={s.errorText}>Vendor not found</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => router.back()}>
            <Text style={s.retryText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const accentColor = CATEGORY_COLORS[vendor.category] ?? '#fbbf24'
  const activeDeals = vendor.vendor_deals?.filter(d => d.is_active) ?? []

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['bottom']}>
      <FlatList
        data={activeDeals}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <DealCard
            deal={item}
            saved={savedDealIds.has(item.id)}
            onToggleSave={handleToggleSave}
          />
        )}
        ListHeaderComponent={
          <>
            {/* Back button */}
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>

            {/* Vendor hero */}
            <View style={[s.hero, { backgroundColor: accentColor + '18' }]}>
              {vendor.logo_url ? (
                <Image source={{ uri: vendor.logo_url }} style={s.heroLogo} resizeMode="contain" />
              ) : (
                <Text style={s.heroEmoji}>{vendor.icon ?? '🏪'}</Text>
              )}
            </View>

            {/* Info */}
            <View style={s.infoSection}>
              <View style={s.infoHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.vendorName}>{vendor.name}</Text>
                  <View style={s.metaRow}>
                    <Text style={[s.categoryBadge, { color: accentColor }]}>{vendor.category}</Text>
                    <Text style={s.sep}>·</Text>
                    <Ionicons name="location-outline" size={12} color="rgba(240,240,255,0.4)" />
                    <Text style={s.location}>{vendor.location_text}</Text>
                  </View>
                </View>
                <View style={[s.dealCountBadge, { backgroundColor: accentColor + '22' }]}>
                  <Ionicons name="pricetag-outline" size={12} color={accentColor} />
                  <Text style={[s.dealCountText, { color: accentColor }]}>
                    {activeDeals.length} deals
                  </Text>
                </View>
              </View>

              {vendor.description && (
                <Text style={s.description}>{vendor.description}</Text>
              )}
            </View>

            <Text style={s.sectionTitle}>Active Deals</Text>
          </>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="pricetag-outline" size={36} color="rgba(240,240,255,0.1)" />
            <Text style={s.emptyText}>No active deals right now</Text>
            <Text style={s.emptySub}>Check back soon for student discounts</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  centeredWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: 'rgba(240,240,255,0.4)' },
  retryBtn: { backgroundColor: '#fbbf24', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  retryText: { fontSize: 13, fontWeight: '600', color: '#000' },
  backBtn: {
    position: 'absolute', top: 48, left: 16, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  hero: { width: '100%', height: 200, alignItems: 'center', justifyContent: 'center' },
  heroLogo: { width: 120, height: 120, borderRadius: 20 },
  heroEmoji: { fontSize: 64 },
  infoSection: { paddingHorizontal: 16, paddingVertical: 16 },
  infoHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  vendorName: { fontSize: 22, fontWeight: '700', color: '#f0f0ff', marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  categoryBadge: { fontSize: 12, fontWeight: '600' },
  sep: { fontSize: 12, color: 'rgba(240,240,255,0.2)' },
  location: { fontSize: 12, color: 'rgba(240,240,255,0.4)' },
  dealCountBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
  },
  dealCountText: { fontSize: 12, fontWeight: '600' },
  description: {
    fontSize: 13, color: 'rgba(240,240,255,0.6)', lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '600', color: 'rgba(240,240,255,0.5)',
    paddingHorizontal: 16, marginBottom: 10,
  },
  // Deal card
  dealCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: '#1c1c2e', borderRadius: 14, padding: 14,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  dealCardExpired: { opacity: 0.5 },
  discountBadge: {
    backgroundColor: 'rgba(251,191,36,0.15)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 0.5, borderColor: 'rgba(251,191,36,0.3)',
    alignSelf: 'flex-start',
  },
  discountText: { fontSize: 13, fontWeight: '700', color: '#fbbf24' },
  dealTitle: { fontSize: 14, fontWeight: '600', color: '#f0f0ff', marginBottom: 4 },
  dealDesc: { fontSize: 12, color: 'rgba(240,240,255,0.5)', lineHeight: 17, marginBottom: 6 },
  dealMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  redeemText: { fontSize: 11, color: 'rgba(240,240,255,0.4)', flex: 1 },
  validUntil: { fontSize: 10, color: 'rgba(240,240,255,0.35)' },
  expired: { color: 'rgba(239,68,68,0.6)' },
  saveBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: 'rgba(240,240,255,0.4)' },
  emptySub: { fontSize: 12, color: 'rgba(240,240,255,0.25)' },
})
