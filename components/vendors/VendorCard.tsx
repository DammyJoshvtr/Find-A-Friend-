/**
 * components/vendors/VendorCard.tsx
 * Vendor card — logo/icon, name, category, location, deals count badge.
 */
import React from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import type { VendorWithDeals } from '../../lib/vendors'
import { useTheme } from '../../lib/theme'

interface VendorCardProps {
  vendor: VendorWithDeals
}

const CATEGORY_COLORS: Record<string, string> = {
  Food: '#fbbf24',
  Fashion: '#f472b6',
  Tech: '#60a5fa',
  Beauty: '#c084fc',
  Books: '#34d399',
  Health: '#4ade80',
  Services: '#a78bfa',
}

export default function VendorCard({ vendor }: VendorCardProps) {
  const theme = useTheme()
  const accentColor = CATEGORY_COLORS[vendor.category] ?? theme.accent
  const activeDeals = vendor.vendor_deals?.filter(d => d.is_active).length ?? 0

  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={() => router.push(`/vendor/${vendor.id}` as any)}
      activeOpacity={0.85}>

      {/* Logo / Icon area */}
      <View style={[s.logoWrap, { backgroundColor: accentColor + '18' }]}>
        {vendor.logo_url ? (
          <Image source={{ uri: vendor.logo_url }} style={s.logo} resizeMode="cover" />
        ) : (
          <Text style={[s.iconEmoji, { color: accentColor }]}>
            {vendor.icon ?? '🏪'}
          </Text>
        )}
      </View>

      {/* Info */}
      <View style={s.info}>
        <Text style={[s.name, { color: theme.text }]} numberOfLines={1}>{vendor.name}</Text>
        <View style={s.metaRow}>
          <Text style={[s.category, { color: accentColor }]}>{vendor.category}</Text>
          <Text style={[s.sep, { color: theme.textFaint }]}>·</Text>
          <Ionicons name="location-outline" size={10} color={theme.textMuted} />
          <Text style={[s.location, { color: theme.textMuted }]} numberOfLines={1}>{vendor.location_text}</Text>
        </View>
      </View>

      {/* Deals badge */}
      {activeDeals > 0 && (
        <View style={[s.dealsBadge, { backgroundColor: accentColor + '22', borderColor: accentColor + '50' }]}>
          <Ionicons name="pricetag-outline" size={9} color={accentColor} />
          <Text style={[s.dealsCount, { color: accentColor }]}>{activeDeals}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  card: {
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 0.5,
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
  },
  logoWrap: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  logo: { width: 48, height: 48, borderRadius: 14 },
  iconEmoji: { fontSize: 22 },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  category: { fontSize: 10, fontWeight: '600' },
  sep: { fontSize: 10 },
  location: { fontSize: 10, flex: 1 },
  dealsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 0.5,
  },
  dealsCount: { fontSize: 10, fontWeight: '600' },
})
