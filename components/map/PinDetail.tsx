/**
 * components/map/PinDetail.tsx
 * Bottom sheet showing details of a selected map pin.
 */
import React from 'react'
import {
  View, Text, StyleSheet, Modal,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import type { MapLocation } from '../../lib/map'

interface PinDetailProps {
  pin: MapLocation | null
  onClose: () => void
}

const TYPE_LABELS: Record<string, string> = {
  building: 'Building',
  vendor: 'Vendor',
  event_venue: 'Event Venue',
  landmark: 'Landmark',
}

export default function PinDetail({ pin, onClose }: PinDetailProps) {
  if (!pin) return null

  const handleViewDetails = () => {
    onClose()
    // Navigate based on category type
    if (pin.category === 'event_venue') {
      router.push('/(tabs)/events' as any)
    } else if (pin.category === 'vendor') {
      router.push('/vendors' as any)
    }
  }

  return (
    <Modal
      visible={!!pin}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.header}>
            <View style={[s.iconBubble, { backgroundColor: pin.color + '22' }]}>
              <Ionicons name="location" size={20} color={pin.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.pinName}>{pin.name}</Text>
              <Text style={s.pinType}>{TYPE_LABELS[pin.category] ?? pin.category}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="rgba(240,240,255,0.4)" />
            </TouchableOpacity>
          </View>

          {pin.description ? (
            <Text style={s.description}>{pin.description}</Text>
          ) : (
            <Text style={s.noDescription}>No description available.</Text>
          )}

          {(pin.category === 'event_venue' || pin.category === 'vendor') && (
            <TouchableOpacity style={s.viewBtn} onPress={handleViewDetails}>
              <Text style={s.viewBtnText}>View Details</Text>
              <Ionicons name="arrow-forward" size={14} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    backgroundColor: '#1c1c2e',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginBottom: 16,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12,
  },
  iconBubble: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  pinName: { fontSize: 16, fontWeight: '600', color: '#f0f0ff' },
  pinType: { fontSize: 11, color: 'rgba(240,240,255,0.4)', marginTop: 1 },
  description: {
    fontSize: 13, color: 'rgba(240,240,255,0.6)', lineHeight: 20, marginBottom: 16,
  },
  noDescription: {
    fontSize: 13, color: 'rgba(240,240,255,0.3)', fontStyle: 'italic', marginBottom: 16,
  },
  viewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#a78bfa', borderRadius: 14,
    paddingVertical: 13,
  },
  viewBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
})
