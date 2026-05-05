/**
 * app/(tabs)/map.tsx
 * Campus map with pan/zoom, DB pins, and filter bar.
 */
import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Dimensions, ScrollView,
  PanResponder, Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getMapPins } from '../../lib/map'
import MapPin from '../../components/map/MapPin'
import PinDetail from '../../components/map/PinDetail'
import type { MapLocation, MapPinCategory } from '../../lib/map'

const { width: SCREEN_W } = Dimensions.get('window')
const MAP_W = SCREEN_W - 32
const MAP_H = MAP_W * 0.65

type FilterOption = 'All' | MapPinCategory

const FILTERS: { label: string; value: FilterOption }[] = [
  { label: 'All', value: 'All' },
  { label: 'Events', value: 'event_venue' },
  { label: 'Buildings', value: 'building' },
  { label: 'Vendors', value: 'vendor' },
  { label: 'Landmarks', value: 'landmark' },
]

export default function MapScreen() {
  const [pins, setPins] = useState<MapLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterOption>('All')
  const [selectedPin, setSelectedPin] = useState<MapLocation | null>(null)

  // Pan / zoom state
  const scale = useRef(new Animated.Value(1)).current
  const translateX = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(0)).current
  const lastScale = useRef(1)
  const lastTranslate = useRef({ x: 0, y: 0 })
  const initialDistance = useRef<number | null>(null)

  useEffect(() => {
    loadPins()
  }, [])

  const loadPins = async () => {
    setLoading(true)
    const { data, error: err } = await getMapPins()
    if (err) setError(err.message)
    else setPins(data ?? [])
    setLoading(false)
  }

  const filteredPins = filter === 'All'
    ? pins
    : pins.filter(p => p.category === filter)

  // Gesture responder for pan + pinch
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        lastTranslate.current = {
          x: (translateX as any)._value,
          y: (translateY as any)._value,
        }
        lastScale.current = (scale as any)._value
      },
      onPanResponderMove: (evt, gs) => {
        const touches = evt.nativeEvent.touches
        if (touches.length === 2) {
          // Pinch to zoom
          const t0 = touches[0]
          const t1 = touches[1]
          const dist = Math.hypot(
            t0.pageX - t1.pageX,
            t0.pageY - t1.pageY
          )
          if (initialDistance.current === null) {
            initialDistance.current = dist
          } else {
            const ratio = dist / initialDistance.current
            const newScale = Math.min(3, Math.max(1, lastScale.current * ratio))
            scale.setValue(newScale)
          }
        } else {
          // Pan
          translateX.setValue(lastTranslate.current.x + gs.dx)
          translateY.setValue(lastTranslate.current.y + gs.dy)
          initialDistance.current = null
        }
      },
      onPanResponderRelease: () => {
        lastScale.current = (scale as any)._value
        lastTranslate.current = {
          x: (translateX as any)._value,
          y: (translateY as any)._value,
        }
        initialDistance.current = null
      },
    })
  ).current

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Campus Map</Text>
        <View style={s.liveBadge}>
          <View style={s.liveDot} />
          <Text style={s.liveText}>Live</Text>
        </View>
      </View>

      {/* Filter bar */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterBar}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.value}
            style={[s.filterPill, filter === f.value && s.filterPillActive]}
            onPress={() => setFilter(f.value)}>
            <Text style={[s.filterText, filter === f.value && s.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Map */}
      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color="#a78bfa" />
        </View>
      ) : error ? (
        <View style={s.loadingWrap}>
          <Text style={s.errorText}>Could not load map</Text>
          <TouchableOpacity style={s.retryBtn} onPress={loadPins}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.mapOuter} {...panResponder.panHandlers}>
          <Animated.View
            style={[
              s.mapInner,
              {
                transform: [
                  { translateX },
                  { translateY },
                  { scale },
                ],
              },
            ]}>
            {/* Campus map — placeholder grid until a real map image is added */}
            <View style={{ width: MAP_W, height: MAP_H, backgroundColor: '#1a2035', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#4a5568', fontSize: 13 }}>Campus Map</Text>
              <Text style={{ color: '#4a5568', fontSize: 11, marginTop: 4 }}>Upload campus-map.png to assets/images</Text>
            </View>

            {/* Pins */}
            {filteredPins.map(pin => (
              <MapPin
                key={pin.id}
                pin={pin}
                mapWidth={MAP_W}
                mapHeight={MAP_H}
                selected={selectedPin?.id === pin.id}
                onPress={setSelectedPin}
              />
            ))}
          </Animated.View>
        </View>
      )}

      {/* Pin count */}
      <Text style={s.pinCount}>
        {filteredPins.length} location{filteredPins.length !== 1 ? 's' : ''}
      </Text>

      {/* Pin detail sheet */}
      <PinDetail
        pin={selectedPin}
        onClose={() => setSelectedPin(null)}
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d14' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#f0f0ff' },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 0.5, borderColor: 'rgba(52,211,153,0.3)',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34d399' },
  liveText: { fontSize: 11, color: '#34d399', fontWeight: '500' },
  filterBar: { paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#1c1c2e',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  filterPillActive: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderColor: 'rgba(167,139,250,0.4)',
  },
  filterText: { fontSize: 12, color: 'rgba(240,240,255,0.4)' },
  filterTextActive: { color: '#a78bfa', fontWeight: '500' },
  mapOuter: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#141420',
    height: MAP_H,
  },
  mapInner: {
    width: MAP_W,
    height: MAP_H,
    position: 'relative',
  },
  pinCount: {
    fontSize: 11, color: 'rgba(240,240,255,0.3)',
    textAlign: 'center', marginTop: 8,
  },
  loadingWrap: {
    height: MAP_H + 40,
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  errorText: { fontSize: 14, color: 'rgba(240,240,255,0.4)' },
  retryBtn: {
    backgroundColor: '#a78bfa', borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 8,
  },
  retryText: { fontSize: 13, fontWeight: '600', color: '#fff' },
})
