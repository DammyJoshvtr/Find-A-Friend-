import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withSequence,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { rsvpEvent, cancelRsvp } from '../../lib/events'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'
import type { Event } from '../../lib/events'

const CATEGORY_COLORS: Record<string, string> = {
  Technology: '#22d3ee',
  Sports:     '#34d399',
  Culture:    '#f59e0b',
  Academic:   '#818cf8',
  Music:      '#ec4899',
  Art:        '#a78bfa',
  Social:     '#fb923c',
  Other:      '#64748b',
}

interface EventCardProps {
  event: Event
  onRsvpChange?: (eventId: string, status: 'going' | null) => void
}

export default function EventCard({ event, onRsvpChange }: EventCardProps) {
  const [rsvpStatus, setRsvpStatus] = useState(event.user_rsvp_status ?? null)
  const [rsvpCount, setRsvpCount] = useState(event.rsvp_count)
  const [loading, setLoading] = useState(false)
  const theme = useTheme()

  const catColor = CATEGORY_COLORS[event.category ?? ''] ?? theme.accent
  const isGoing = rsvpStatus === 'going'

  const cardScale = useSharedValue(1)
  const btnScale = useSharedValue(1)

  const handlePress = () => {
    cardScale.value = withSequence(
      withSpring(0.975, { damping: 12, stiffness: 300 }),
      withSpring(1, { damping: 14, stiffness: 200 })
    )
    router.push(`/event/${event.id}` as any)
  }

  const handleRsvp = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    btnScale.value = withSequence(
      withSpring(0.75, { damping: 8, stiffness: 500 }),
      withSpring(1.15, { damping: 10, stiffness: 300 }),
      withSpring(1, { damping: 14, stiffness: 200 })
    )
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
  const dayStr = startDate.getDate().toString()
  const monthStr = startDate.toLocaleDateString('en', { month: 'short' }).toUpperCase()
  const timeStr = startDate.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })

  const cardAnim = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }))
  const btnAnim = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }))

  return (
    <Animated.View style={[cardAnim, s.wrapper]}>
      <TouchableOpacity
        style={[s.card, { backgroundColor: 'rgba(12,12,32,0.85)', borderColor: `${catColor}22` }]}
        onPress={handlePress}
        activeOpacity={0.9}>

        <View style={[s.accentLine, { backgroundColor: catColor }]} />

        <View style={s.body}>
          <View style={[s.dateBlock, { backgroundColor: `${catColor}12` }]}>
            <Text style={[s.dateDay, { color: catColor }]}>{dayStr}</Text>
            <Text style={[s.dateMon, { color: `${catColor}aa` }]}>{monthStr}</Text>
          </View>

          <View style={s.info}>
            <Text style={[s.title, { color: theme.text }]} numberOfLines={1}>{event.title}</Text>
            {event.venue ? (
              <View style={s.metaRow}>
                <Ionicons name="location-outline" size={10} color={theme.textFaint} />
                <Text style={[s.metaText, { color: theme.textFaint }]} numberOfLines={1}>{event.venue}</Text>
              </View>
            ) : null}
            <View style={s.metaRow}>
              <Ionicons name="time-outline" size={10} color={theme.textFaint} />
              <Text style={[s.metaText, { color: theme.textFaint }]}>{timeStr}</Text>
              {event.category ? (
                <View style={[s.catBadge, { backgroundColor: `${catColor}14`, borderColor: `${catColor}30` }]}>
                  <Text style={[s.catText, { color: catColor }]}>{event.category}</Text>
                </View>
              ) : null}
              {event.clubs && (
                <TouchableOpacity
                  style={[s.catBadge, { backgroundColor: 'rgba(167,139,250,0.1)', borderColor: 'rgba(167,139,250,0.3)' }]}
                  onPress={() => router.push(`/club/${event.club_id}` as any)}>
                  <Text style={[s.catText, { color: theme.accent }]}>♣ {event.clubs.name}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={s.side}>
            <Text style={[s.rsvpCount, { color: catColor }]}>{rsvpCount}</Text>
            <Text style={[s.rsvpLabel, { color: theme.textFaint }]}>going</Text>
            <Animated.View style={btnAnim}>
              <TouchableOpacity
                style={[
                  s.rsvpBtn,
                  isGoing
                    ? { backgroundColor: catColor, borderColor: catColor, shadowColor: catColor, shadowOffset: { width: 0, height: 0 }, shadowRadius: 8, shadowOpacity: 0.6, elevation: 6 }
                    : { backgroundColor: `${catColor}14`, borderColor: `${catColor}35` },
                ]}
                onPress={handleRsvp}
                disabled={loading}>
                {loading
                  ? <ActivityIndicator size="small" color={isGoing ? '#fff' : catColor} />
                  : <Ionicons name={isGoing ? 'checkmark' : 'add'} size={17} color={isGoing ? '#fff' : catColor} />
                }
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  wrapper: { marginHorizontal: 16, marginBottom: 8 },
  card: {
    borderRadius: 16, borderWidth: 1,
    flexDirection: 'row', overflow: 'hidden',
  },
  accentLine: { width: 3 },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  dateBlock: {
    width: 42, height: 48, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  dateDay: { fontSize: 20, fontFamily: typography.fontBold, lineHeight: 24 },
  dateMon: { fontSize: 9, fontFamily: typography.fontSemiBold, letterSpacing: 1 },
  info: { flex: 1, gap: 3 },
  title: { fontSize: 13, fontFamily: typography.fontSemiBold },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 10, fontFamily: typography.fontRegular, flex: 1 },
  catBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 0.5 },
  catText: { fontSize: 8, fontFamily: typography.fontSemiBold, letterSpacing: 0.5 },
  side: { alignItems: 'center', gap: 2, flexShrink: 0 },
  rsvpCount: { fontSize: 15, fontFamily: typography.fontBold, lineHeight: 19 },
  rsvpLabel: { fontSize: 8, fontFamily: typography.fontMedium },
  rsvpBtn: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, marginTop: 4,
  },
})
