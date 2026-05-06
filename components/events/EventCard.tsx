import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { rsvpEvent, cancelRsvp } from '../../lib/events'
import { useTheme } from '../../lib/theme'
import type { Event } from '../../lib/events'

interface EventCardProps {
  event: Event
  onRsvpChange?: (eventId: string, status: 'going' | null) => void
}

export default function EventCard({ event, onRsvpChange }: EventCardProps) {
  const [rsvpStatus, setRsvpStatus] = useState(event.user_rsvp_status ?? null)
  const [rsvpCount, setRsvpCount] = useState(event.rsvp_count)
  const [loading, setLoading] = useState(false)
  const theme = useTheme()

  const isGoing = rsvpStatus === 'going'

  const handleRsvp = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setLoading(true)
    if (isGoing) {
      setRsvpStatus(null)
      setRsvpCount(c => Math.max(0, c - 1))
      const { error } = await cancelRsvp(event.id)
      if (error) { setRsvpStatus('going'); setRsvpCount(c => c + 1) }
      else onRsvpChange?.(event.id, null)
    } else {
      setRsvpStatus('going')
      setRsvpCount(c => c + 1)
      const { error } = await rsvpEvent(event.id, 'going')
      if (error) { setRsvpStatus(null); setRsvpCount(c => Math.max(0, c - 1)) }
      else onRsvpChange?.(event.id, 'going')
    }
    setLoading(false)
  }

  const startDate = new Date(event.starts_at)
  const monthStr = startDate.toLocaleDateString('en', { month: 'short' }).toUpperCase()
  const dayStr = startDate.getDate().toString()
  const timeStr = startDate.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })

  return (
    <TouchableOpacity style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={() => router.push(`/event/${event.id}` as any)} activeOpacity={0.85}>
      {event.cover_image_url ? (
        <Image source={{ uri: event.cover_image_url }} style={s.cover} resizeMode="cover" />
      ) : (
        <View style={[s.cover, s.coverPlaceholder, { backgroundColor: theme.card2 }]}>
          <Ionicons name="calendar-outline" size={32} color={theme.textFaint} />
        </View>
      )}

      <View style={s.body}>
        <View style={s.dateCol}>
          <Text style={[s.month, { color: theme.textMuted }]}>{monthStr}</Text>
          <Text style={[s.day, { color: theme.text }]}>{dayStr}</Text>
        </View>

        <View style={s.info}>
          <Text style={[s.title, { color: theme.text }]} numberOfLines={2}>{event.title}</Text>
          {event.venue ? (
            <View style={s.row}>
              <Ionicons name="location-outline" size={11} color={theme.textMuted} />
              <Text style={[s.meta, { color: theme.textMuted }]} numberOfLines={1}>{event.venue}</Text>
            </View>
          ) : null}
          <View style={s.row}>
            <Ionicons name="time-outline" size={11} color={theme.textMuted} />
            <Text style={[s.meta, { color: theme.textMuted }]}>{timeStr}</Text>
          </View>
          <View style={s.footer}>
            {event.category ? (
              <View style={[s.badge, { backgroundColor: theme.accentBg }]}>
                <Text style={[s.badgeText, { color: theme.accent }]}>{event.category}</Text>
              </View>
            ) : null}
            <Text style={[s.attendees, { color: theme.textFaint }]}>{rsvpCount} going</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[s.rsvpBtn, { backgroundColor: theme.accentBg, borderColor: theme.accentBorder }, isGoing && { backgroundColor: theme.accent, borderColor: theme.accent }]}
          onPress={handleRsvp} disabled={loading}>
          {loading
            ? <ActivityIndicator size="small" color={isGoing ? '#fff' : theme.accent} />
            : <Text style={[s.rsvpText, { color: isGoing ? '#fff' : theme.accent }]}>{isGoing ? 'Going' : 'RSVP'}</Text>
          }
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  card: { borderRadius: 16, marginHorizontal: 16, marginBottom: 12, overflow: 'hidden', borderWidth: 0.5 },
  cover: { width: '100%', height: 140 },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  body: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  dateCol: { alignItems: 'center', width: 36, flexShrink: 0 },
  month: { fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
  day: { fontSize: 22, fontWeight: '700', lineHeight: 26 },
  info: { flex: 1 },
  title: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  meta: { fontSize: 11 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 9, fontWeight: '500' },
  attendees: { fontSize: 10 },
  rsvpBtn: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 0.5, minWidth: 56, alignItems: 'center' },
  rsvpText: { fontSize: 11, fontWeight: '600' },
})
