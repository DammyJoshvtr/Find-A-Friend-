/**
 * app/event/[id].tsx
 * Event detail — hero image, info, attendees, RSVP, map link.
 */
import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getEventDetail, getEventAttendees, rsvpEvent, cancelRsvp, deleteEvent } from '../../lib/events'
import { getInitials } from '../../lib/matching'
import type { Event, EventRsvp } from '../../lib/events'
import { supabase } from '../../lib/supabase'

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [event, setEvent] = useState<Event | null>(null)
  const [attendees, setAttendees] = useState<EventRsvp[]>([])
  const [loading, setLoading] = useState(true)
  const [rsvpLoading, setRsvpLoading] = useState(false)
  const [rsvpStatus, setRsvpStatus] = useState<'going' | 'interested' | 'not_going' | null>(null)
  const [myUserId, setMyUserId] = useState<string | null>(null)

  useEffect(() => {
    if (id) loadData()
  }, [id])

  useEffect(() => {
    if (!id) return;

    const eventChannel = supabase
      .channel(`event-detail-realtime-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "events",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const updated = payload.new as Event;
          setEvent((e) => (e ? { ...e, rsvp_count: updated.rsvp_count } : e));
        }
      )
      .subscribe();

    const rsvpsChannel = supabase
      .channel(`event-rsvps-realtime-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_rsvps",
          filter: `event_id=eq.${id}`,
        },
        async () => {
          const attendeesRes = await getEventAttendees(id, "going");
          setAttendees(attendeesRes.data ?? []);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(eventChannel);
      supabase.removeChannel(rsvpsChannel);
    };
  }, [id]);

  const loadData = async () => {
    setLoading(true)
    try {
      const [eventRes, attendeesRes, authUserRes] = await Promise.all([
        getEventDetail(id),
        getEventAttendees(id, 'going'),
        supabase.auth.getUser()
      ])
      setEvent(eventRes.data)
      setRsvpStatus(eventRes.data?.user_rsvp_status ?? null)
      setAttendees(attendeesRes.data ?? [])
      if (authUserRes.data?.user) {
        setMyUserId(authUserRes.data.user.id)
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteEvent = async () => {
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true)
            const { error } = await deleteEvent(id)
            setLoading(false)
            if (error) {
              Alert.alert('Error', error.message)
            } else {
              Alert.alert('Deleted', 'The event has been successfully deleted.')
              router.back()
            }
          }
        }
      ]
    )
  }


  const handleRsvp = async () => {
    if (!event) return
    setRsvpLoading(true)
    if (rsvpStatus === 'going') {
      const { error } = await cancelRsvp(event.id)
      if (!error) {
        setRsvpStatus(null)
        setEvent(e => e ? { ...e, rsvp_count: Math.max(0, e.rsvp_count - 1) } : e)
      }
    } else {
      const { error } = await rsvpEvent(event.id, 'going')
      if (!error) {
        setRsvpStatus('going')
        setEvent(e => e ? { ...e, rsvp_count: e.rsvp_count + 1 } : e)
      }
    }
    setRsvpLoading(false)
  }

  const handleViewOnMap = () => {
    router.push('/(tabs)/map' as any)
  }

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color="#a78bfa" />
        </View>
      </SafeAreaView>
    )
  }

  if (!event) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.loadingWrap}>
          <Text style={s.errorText}>Event not found</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => router.back()}>
            <Text style={s.retryText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const startDate = new Date(event.starts_at)
  const dateStr = startDate.toLocaleDateString('en', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
  const timeStr = startDate.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
  const isGoing = rsvpStatus === 'going'
  const shownAttendees = attendees.slice(0, 5)
  const extraAttendees = Math.max(0, event.rsvp_count - 5)

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={s.heroWrap}>
          {event.cover_image_url ? (
            <Image source={{ uri: event.cover_image_url }} style={s.hero} resizeMode="cover" />
          ) : (
            <View style={[s.hero, s.heroPlaceholder]}>
              <Ionicons name="calendar" size={48} color="rgba(167,139,250,0.3)" />
            </View>
          )}
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          {(event.organizer_id === myUserId) && (
            <View style={s.actionBtnsRight}>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}
                onPress={() => router.push(`/edit-event/${event.id}` as any)}>
                <Ionicons name="pencil-outline" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.8)' }]}
                onPress={handleDeleteEvent}>
                <Ionicons name="trash-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={s.content}>
          {/* Category & Club Badge Row */}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            {event.category && (
              <View style={s.categoryBadge}>
                <Text style={s.categoryText}>{event.category}</Text>
              </View>
            )}

            {event.clubs && (
              <TouchableOpacity
                style={[s.clubBadgeRow, { backgroundColor: 'rgba(167,139,250,0.08)', borderColor: 'rgba(167,139,250,0.2)' }]}
                onPress={() => router.push(`/club/${event.club_id}` as any)}>
                <Ionicons name="people-outline" size={12} color="#a78bfa" style={{ marginRight: 4 }} />
                <Text style={s.clubBadgeText}>Organized by {event.clubs.name}</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={s.title}>{event.title}</Text>

          {/* Date & Time */}
          <View style={s.infoRow}>
            <View style={s.infoIcon}>
              <Ionicons name="calendar-outline" size={18} color="#a78bfa" />
            </View>
            <View>
              <Text style={s.infoLabel}>{dateStr}</Text>
              <Text style={s.infoSub}>{timeStr}</Text>
            </View>
          </View>

          {/* Venue */}
          {event.venue && (
            <TouchableOpacity style={s.infoRow} onPress={handleViewOnMap}>
              <View style={s.infoIcon}>
                <Ionicons name="location-outline" size={18} color="#34d399" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.infoLabel}>{event.venue}</Text>
                <Text style={[s.infoSub, { color: '#34d399' }]}>View on map</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="rgba(240,240,255,0.3)" />
            </TouchableOpacity>
          )}

          {/* Description */}
          {event.description && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>About</Text>
              <Text style={s.description}>{event.description}</Text>
            </View>
          )}

          {/* Attendees */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>{event.rsvp_count} going</Text>
            <View style={s.attendeesRow}>
              {shownAttendees.map((a, i) => (
                <View
                  key={a.id}
                  style={[s.attendeeAvatar, { marginLeft: i > 0 ? -10 : 0, zIndex: shownAttendees.length - i }]}>
                  {a.profiles?.avatar_url ? (
                    <Image source={{ uri: a.profiles.avatar_url }} style={s.attendeeImg} />
                  ) : (
                    <Text style={s.attendeeInitials}>
                      {getInitials(a.profiles?.full_name ?? '?')}
                    </Text>
                  )}
                </View>
              ))}
              {extraAttendees > 0 && (
                <View style={[s.attendeeAvatar, s.attendeeExtra, { marginLeft: -10 }]}>
                  <Text style={s.attendeeExtraText}>+{extraAttendees}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* RSVP button */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.rsvpBtn, isGoing && s.rsvpBtnActive]}
          onPress={handleRsvp}
          disabled={rsvpLoading}>
          {rsvpLoading ? (
            <ActivityIndicator color={isGoing ? '#fff' : '#a78bfa'} />
          ) : (
            <>
              <Ionicons
                name={isGoing ? 'checkmark-circle' : 'calendar-outline'}
                size={18}
                color={isGoing ? '#fff' : '#a78bfa'}
              />
              <Text style={[s.rsvpText, isGoing && s.rsvpTextActive]}>
                {isGoing ? "You're going!" : 'RSVP to this event'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d14' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: 'rgba(240,240,255,0.4)' },
  retryBtn: {
    backgroundColor: '#a78bfa', borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 8,
  },
  retryText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  heroWrap: { position: 'relative' },
  hero: { width: '100%', height: 260 },
  heroPlaceholder: {
    backgroundColor: '#141420', alignItems: 'center', justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute', top: 48, left: 16,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnsRight: {
    position: 'absolute', top: 48, right: 16,
    flexDirection: 'row', gap: 8,
  },
  actionBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: 20 },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
    marginBottom: 10,
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)',
  },
  categoryText: { fontSize: 11, color: '#a78bfa', fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '700', color: '#f0f0ff', marginBottom: 16, lineHeight: 28 },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 14,
  },
  infoIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#1c1c2e',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  infoLabel: { fontSize: 13, fontWeight: '500', color: '#f0f0ff' },
  infoSub: { fontSize: 11, color: 'rgba(240,240,255,0.4)', marginTop: 1 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: 'rgba(240,240,255,0.5)', marginBottom: 10 },
  description: { fontSize: 14, color: 'rgba(240,240,255,0.7)', lineHeight: 22 },
  attendeesRow: { flexDirection: 'row', alignItems: 'center' },
  attendeeAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#2a1e40',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#0d0d14',
    overflow: 'hidden',
  },
  attendeeImg: { width: 32, height: 32, borderRadius: 16 },
  attendeeInitials: { fontSize: 10, fontWeight: '700', color: '#c4b5fd' },
  attendeeExtra: { backgroundColor: '#1c1c2e' },
  attendeeExtraText: { fontSize: 9, fontWeight: '700', color: 'rgba(240,240,255,0.6)' },
  footer: {
    padding: 16,
    borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#0d0d14',
  },
  rsvpBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 16, paddingVertical: 16,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)',
  },
  rsvpBtnActive: { backgroundColor: '#a78bfa', borderColor: '#a78bfa' },
  rsvpText: { fontSize: 15, fontWeight: '600', color: '#a78bfa' },
  rsvpTextActive: { color: '#fff' },
  clubBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  clubBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#a78bfa',
  },
})
