/**
 * components/events/EventCard.tsx
 * Event card with cover image, details, and RSVP toggle.
 */
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { rsvpEvent, cancelRsvp } from '../../lib/events'
import type { Event } from '../../lib/events'

interface EventCardProps {
  event: Event
  onRsvpChange?: (eventId: string, status: 'going' | null) => void
}

export default function EventCard({ event, onRsvpChange }: EventCardProps) {
  const [rsvpStatus, setRsvpStatus] = useState(event.user_rsvp_status ?? null)
  const [rsvpCount, setRsvpCount] = useState(event.rsvp_count)
  const [loading, setLoading] = useState(false)

  const isGoing = rsvpStatus === 'going'

  const handleRsvp = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setLoading(true)
    if (isGoing) {
      // Optimistic cancel
      setRsvpStatus(null)
      setRsvpCount(c => Math.max(0, c - 1))
      const { error } = await cancelRsvp(event.id)
      if (error) {
        setRsvpStatus('going')
        setRsvpCount(c => c + 1)
      } else {
        onRsvpChange?.(event.id, null)
      }
    } else {
      setRsvpStatus('going')
      setRsvpCount(c => c + 1)
      const { error } = await rsvpEvent(event.id, 'going')
      if (error) {
        setRsvpStatus(null)
        setRsvpCount(c => Math.max(0, c - 1))
      } else {
        onRsvpChange?.(event.id, 'going')
      }
    }
    setLoading(false)
  }

  const handlePress = () => {
    router.push(`/event/${event.id}` as any)
  }

  const startDate = new Date(event.starts_at)
  const monthStr = startDate.toLocaleDateString('en', { month: 'short' }).toUpperCase()
  const dayStr = startDate.getDate().toString()
  const timeStr = startDate.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })

  return (
    <TouchableOpacity style={s.card} onPress={handlePress} activeOpacity={0.85}>
      {/* Cover */}
      {event.cover_image_url ? (
        <Image source={{ uri: event.cover_image_url }} style={s.cover} resizeMode="cover" />
      ) : (
        <View style={[s.cover, s.coverPlaceholder]}>
          <Ionicons name="calendar-outline" size={32} color="rgba(167,139,250,0.4)" />
        </View>
      )}

      <View style={s.body}>
        <View style={s.dateCol}>
          <Text style={s.month}>{monthStr}</Text>
          <Text style={s.day}>{dayStr}</Text>
        </View>

        <View style={s.info}>
          <Text style={s.title} numberOfLines={2}>{event.title}</Text>
          {event.venue ? (
            <View style={s.row}>
              <Ionicons name="location-outline" size={11} color="rgba(240,240,255,0.35)" />
              <Text style={s.meta} numberOfLines={1}>{event.venue}</Text>
            </View>
          ) : null}
          <View style={s.row}>
            <Ionicons name="time-outline" size={11} color="rgba(240,240,255,0.35)" />
            <Text style={s.meta}>{timeStr}</Text>
          </View>
          <View style={s.footer}>
            {event.category ? (
              <View style={s.badge}>
                <Text style={s.badgeText}>{event.category}</Text>
              </View>
            ) : null}
            <Text style={s.attendees}>{rsvpCount} going</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[s.rsvpBtn, isGoing && s.rsvpBtnActive]}
          onPress={handleRsvp}
          disabled={loading}>
          {loading
            ? <ActivityIndicator size="small" color={isGoing ? '#fff' : '#a78bfa'} />
            : (
              <Text style={[s.rsvpText, isGoing && s.rsvpTextActive]}>
                {isGoing ? 'Going' : 'RSVP'}
              </Text>
            )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#1c1c2e',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cover: { width: '100%', height: 140 },
  coverPlaceholder: {
    backgroundColor: '#141420',
    alignItems: 'center', justifyContent: 'center',
  },
  body: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, padding: 12,
  },
  dateCol: {
    alignItems: 'center', width: 36, flexShrink: 0,
  },
  month: {
    fontSize: 9, color: 'rgba(240,240,255,0.35)',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  day: { fontSize: 22, fontWeight: '700', color: '#f0f0ff', lineHeight: 26 },
  info: { flex: 1 },
  title: { fontSize: 13, fontWeight: '600', color: '#f0f0ff', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  meta: { fontSize: 11, color: 'rgba(240,240,255,0.35)' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  badge: {
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2,
  },
  badgeText: { fontSize: 9, color: '#a78bfa', fontWeight: '500' },
  attendees: { fontSize: 10, color: 'rgba(240,240,255,0.3)' },
  rsvpBtn: {
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)',
    minWidth: 56, alignItems: 'center',
  },
  rsvpBtnActive: {
    backgroundColor: '#a78bfa', borderColor: '#a78bfa',
  },
  rsvpText: { fontSize: 11, color: '#a78bfa', fontWeight: '600' },
  rsvpTextActive: { color: '#fff' },
})
