/**
 * components/map/MapPin.tsx
 * Colored circle pin positioned as a percentage of the map image.
 */
import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { MapLocation, MapPinCategory } from '../../lib/map'

const CATEGORY_ICONS: Record<MapPinCategory, string> = {
  building: 'business-outline',
  vendor: 'storefront-outline',
  event_venue: 'calendar-outline',
  landmark: 'flag-outline',
}

const CATEGORY_COLORS: Record<MapPinCategory, string> = {
  building: '#a78bfa',
  vendor: '#fbbf24',
  event_venue: '#60a5fa',
  landmark: '#34d399',
}

interface MapPinProps {
  pin: MapLocation
  mapWidth: number
  mapHeight: number
  selected?: boolean
  onPress: (pin: MapLocation) => void
}

export default function MapPin({ pin, mapWidth, mapHeight, selected, onPress }: MapPinProps) {
  const color = pin.color || CATEGORY_COLORS[pin.category] || '#a78bfa'
  const iconName = CATEGORY_ICONS[pin.category] ?? 'location-outline'

  const left = pin.pin_x * mapWidth - 18
  const top = pin.pin_y * mapHeight - 36

  return (
    <TouchableOpacity
      style={[
        s.pin,
        { left, top },
        selected && s.pinSelected,
      ]}
      onPress={() => onPress(pin)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <View style={[s.bubble, { backgroundColor: color, borderColor: selected ? '#fff' : color }]}>
        <Ionicons name={iconName as any} size={12} color="#fff" />
      </View>
      <View style={[s.stem, { backgroundColor: color }]} />
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  pin: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 10,
  },
  pinSelected: {
    zIndex: 20,
    transform: [{ scale: 1.2 }],
  },
  bubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  stem: {
    width: 2,
    height: 6,
    borderRadius: 1,
    marginTop: -1,
  },
})
