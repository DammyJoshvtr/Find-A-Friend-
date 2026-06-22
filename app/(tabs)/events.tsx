import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getEvents, getMyRsvps } from '../../lib/events'
import EventCard from '../../components/events/EventCard'
import CalendarGrid from '../../components/events/CalendarGrid'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'
import { useTabBarScroll } from '../../lib/useTabBarScroll'
import { showTabBar } from '../../lib/tabBarAnim'
import { useBadgesStore } from '../../store/badgesStore'
import type { Event } from '../../lib/events'
import { supabase } from '../../lib/supabase'

type Tab = 'upcoming' | 'rsvps' | 'past'

const TABS: { label: string; value: Tab }[] = [
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'My Events', value: 'rsvps' },
  { label: 'Past', value: 'past' },
]


// ---------------------------------------------------------------------------------

type ListItem =
  | { type: 'section'; date: string; label: string }
  | { type: 'event'; event: Event }

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatSectionLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  const todayStr = toDateStr(today)
  const tomorrowStr = toDateStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1))
  if (dateStr === todayStr) return 'Today'
  if (dateStr === tomorrowStr) return 'Tomorrow'
  return d.toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })
}

function buildListData(events: Event[]): ListItem[] {
  if (!events.length) return []
  const grouped = new Map<string, Event[]>()
  for (const e of events) {
    const day = e.starts_at.slice(0, 10)
    if (!grouped.has(day)) grouped.set(day, [])
    grouped.get(day)!.push(e)
  }
  const items: ListItem[] = []
  for (const [day, dayEvents] of [...grouped.entries()].sort()) {
    items.push({ type: 'section', date: day, label: formatSectionLabel(day) })
    for (const event of dayEvents) {
      items.push({ type: 'event', event })
    }
  }
  return items
}


export default function EventsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('upcoming')
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const theme = useTheme()
  const { onScroll, scrollEventThrottle } = useTabBarScroll()
  const markSeen = useBadgesStore(s => s.markSeen)

  useFocusEffect(
    useCallback(() => {
      markSeen('events')
    }, [markSeen])
  )

  useEffect(() => {
    setSelectedDay(null)
    loadTab(activeTab)
  }, [activeTab])

  useEffect(() => {
    const eventChannel = supabase
      .channel("events-list-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "events" },
        (payload) => {
          const updated = payload.new as Event;
          setEvents((prev) =>
            prev.map((e) =>
              e.id === updated.id
                ? { ...e, rsvp_count: updated.rsvp_count }
                : e
            )
          );
        }
      )
      .subscribe();

    let rsvpChannel: any;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      rsvpChannel = supabase
        .channel("my-rsvps-realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "event_rsvps",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
              const newRsvp = payload.new;
              setEvents((prev) =>
                prev.map((e) =>
                  e.id === newRsvp.event_id
                    ? { ...e, user_rsvp_status: newRsvp.status }
                    : e
                )
              );
            } else if (payload.eventType === "DELETE") {
              const oldRsvp = payload.old;
              setEvents((prev) =>
                prev.map((e) =>
                  e.id === oldRsvp.event_id
                    ? { ...e, user_rsvp_status: null }
                    : e
                )
              );
            }
          }
        )
        .subscribe();
    });

    return () => {
      supabase.removeChannel(eventChannel);
      if (rsvpChannel) supabase.removeChannel(rsvpChannel);
    };
  }, []);

  const loadTab = async (tab: Tab) => {
    setLoading(true)
    try {
      if (tab === 'upcoming') {
        const { data, error: err } = await getEvents({ upcoming: true })
        if (err) throw err
        setEvents(data ?? [])
      } else if (tab === 'past') {
        const { data, error: err } = await getEvents({ upcoming: false })
        if (err) throw err
        const now = new Date().toISOString()
        setEvents((data ?? []).filter(e => e.starts_at < now))
      } else {
        const { data, error: err } = await getMyRsvps()
        if (err) throw err
        setEvents((data ?? []).map(r => ({ ...r.event, user_rsvp_status: r.rsvp.status })))
      }
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!loading) {
      showTabBar()
    }
  }, [loading])

  const onRefresh = useCallback(() => { setRefreshing(true); loadTab(activeTab) }, [activeTab])

  const filteredEvents = useMemo(() => {
    if (activeTab !== 'upcoming') return events
    if (selectedDay) return events.filter(e => e.starts_at.slice(0, 10) === selectedDay)
    const yr = viewMonth.getFullYear()
    const mo = String(viewMonth.getMonth() + 1).padStart(2, '0')
    return events.filter(e => e.starts_at.startsWith(`${yr}-${mo}`))
  }, [events, selectedDay, viewMonth, activeTab])

  const listData = useMemo(() => buildListData(filteredEvents), [filteredEvents])

  const handleRsvpChange = useCallback((eventId: string, status: 'going' | null) => {
    setEvents(prev => prev.map(e => {
      if (e.id === eventId) {
        const diff = status === 'going' ? 1 : -1;
        return {
          ...e,
          user_rsvp_status: status,
          rsvp_count: Math.max(0, (e.rsvp_count ?? 0) + diff)
        };
      }
      return e;
    }));
  }, []);

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'section') {
      return (
        <View style={s.sectionHeader}>
          <View style={[s.sectionDot, { backgroundColor: theme.accent }]} />
          <Text style={[s.sectionLabel, { color: theme.accent }]}>{item.label}</Text>
          <View style={[s.sectionLine, { backgroundColor: `${theme.accent}20` }]} />
        </View>
      )
    }
    return <EventCard event={item.event} onRsvpChange={handleRsvpChange} />
  }

  const emptyMessage = activeTab === 'rsvps'
    ? { title: 'No events yet', sub: "Events you create or tap 'Going' on will appear here." }
    : selectedDay
    ? { title: 'No events this day', sub: 'Tap another day or clear selection' }
    : { title: 'No events this month', sub: 'Check back soon or create one.' }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={s.header}>
        <Text style={[s.title, { color: theme.text }]}>Events</Text>
        <TouchableOpacity
          style={[s.createBtn, { backgroundColor: theme.card, borderColor: theme.accentBorder }]}
          onPress={() => router.push('/create-event' as any)}>
          <Ionicons name="add" size={18} color={theme.accent} />
        </TouchableOpacity>
      </View>

      <View style={[s.tabBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.value}
            style={[s.tab, activeTab === tab.value && { backgroundColor: theme.accentBg }]}
            onPress={() => setActiveTab(tab.value)}>
            <Text style={[s.tabText, { color: theme.textMuted }, activeTab === tab.value && { color: theme.accent, fontFamily: typography.fontSemiBold }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'upcoming' && (
        <CalendarGrid
          events={events}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          month={viewMonth}
          onMonthChange={(m) => { setViewMonth(m); setSelectedDay(null) }}
        />
      )}

      {loading && !refreshing ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : (
        <FlatList<ListItem>
          data={listData}
          keyExtractor={(item) => item.type === 'event' ? item.event.id : `section-${item.date}`}
          renderItem={renderItem}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="calendar-outline" size={48} color={theme.textFaint} />
              <Text style={[s.emptyTitle, { color: theme.text }]}>{emptyMessage.title}</Text>
              <Text style={[s.emptyText, { color: theme.textMuted }]}>{emptyMessage.sub}</Text>
            </View>
          }
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity
        style={[s.fab, { backgroundColor: theme.accent }]}
        onPress={() => router.push('/create-event' as any)}>
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  title: { fontSize: 22, fontFamily: typography.fontBold },
  createBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', borderWidth: 0.5,
  },
  tabBar: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 8,
    borderRadius: 12, padding: 3, borderWidth: 0.5,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabText: { fontSize: 12, fontFamily: typography.fontMedium },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 40, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontFamily: typography.fontSemiBold },
  emptyText: { fontSize: 13, textAlign: 'center', fontFamily: typography.fontRegular, color: 'gray' },
  fab: {
    position: 'absolute', bottom: 108, right: 20,
    width: 54, height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 12, marginBottom: 6, gap: 8,
  },
  sectionDot: { width: 5, height: 5, borderRadius: 3 },
  sectionLabel: {
    fontSize: 11, fontFamily: typography.fontSemiBold,
    textTransform: 'uppercase', letterSpacing: 1.2,
  },
  sectionLine: { flex: 1, height: 0.5 },
})
