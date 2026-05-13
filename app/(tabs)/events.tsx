import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getEvents, getMyRsvps } from '../../lib/events'
import EventCard from '../../components/events/EventCard'
import CalendarGrid from '../../components/events/CalendarGrid'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'
import { useTabBarScroll } from '../../lib/useTabBarScroll'
import type { Event } from '../../lib/events'

type Tab = 'upcoming' | 'rsvps' | 'past'

const TABS: { label: string; value: Tab }[] = [
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'My RSVPs', value: 'rsvps' },
  { label: 'Past', value: 'past' },
]

// --- Demo events (relative to today so they always appear on the current month) ---
function demoDate(daysOffset: number, hour: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysOffset)
  d.setHours(hour, 0, 0, 0)
  d.setMilliseconds(0)
  return d.toISOString()
}

const DEMO_EVENTS: Event[] = [
  {
    id: 'demo-1', title: 'Tech Summit 2026', venue: 'Student Union Hall',
    starts_at: demoDate(0, 10), ends_at: demoDate(0, 13),
    description: null, organizer_id: null, club_id: null,
    category: 'Technology', cover_image_url: null,
    rsvp_count: 142, capacity: 300, is_public: true,
    map_pin_x: null, map_pin_y: null, map_location_id: null,
  },
  {
    id: 'demo-2', title: 'Intro to Machine Learning', venue: 'Lab Block C',
    starts_at: demoDate(0, 15), ends_at: demoDate(0, 17),
    description: null, organizer_id: null, club_id: null,
    category: 'Academic', cover_image_url: null,
    rsvp_count: 38, capacity: 60, is_public: true,
    map_pin_x: null, map_pin_y: null, map_location_id: null,
  },
  {
    id: 'demo-3', title: 'Campus Music Night', venue: 'Open Air Stage',
    starts_at: demoDate(1, 19), ends_at: demoDate(1, 22),
    description: null, organizer_id: null, club_id: null,
    category: 'Music', cover_image_url: null,
    rsvp_count: 215, capacity: null, is_public: true,
    map_pin_x: null, map_pin_y: null, map_location_id: null,
  },
  {
    id: 'demo-4', title: 'Basketball Inter-Faculty Finals', venue: 'Sports Complex',
    starts_at: demoDate(3, 14), ends_at: demoDate(3, 17),
    description: null, organizer_id: null, club_id: null,
    category: 'Sports', cover_image_url: null,
    rsvp_count: 89, capacity: 500, is_public: true,
    map_pin_x: null, map_pin_y: null, map_location_id: null,
  },
  {
    id: 'demo-5', title: 'Art & Design Showcase', venue: 'Gallery Hall',
    starts_at: demoDate(5, 11), ends_at: demoDate(5, 18),
    description: null, organizer_id: null, club_id: null,
    category: 'Art', cover_image_url: null,
    rsvp_count: 67, capacity: 200, is_public: true,
    map_pin_x: null, map_pin_y: null, map_location_id: null,
  },
  {
    id: 'demo-6', title: 'Algorithms Study Group', venue: 'Library Block B',
    starts_at: demoDate(5, 16), ends_at: demoDate(5, 18),
    description: null, organizer_id: null, club_id: null,
    category: 'Academic', cover_image_url: null,
    rsvp_count: 12, capacity: 20, is_public: true,
    map_pin_x: null, map_pin_y: null, map_location_id: null,
  },
  {
    id: 'demo-7', title: 'Campus Food & Culture Fair', venue: 'Main Square',
    starts_at: demoDate(9, 12), ends_at: demoDate(9, 20),
    description: null, organizer_id: null, club_id: null,
    category: 'Culture', cover_image_url: null,
    rsvp_count: 308, capacity: null, is_public: true,
    map_pin_x: null, map_pin_y: null, map_location_id: null,
  },
  {
    id: 'demo-8', title: 'Graduation Prep Seminar', venue: 'Lecture Hall 1',
    starts_at: demoDate(14, 9), ends_at: demoDate(14, 11),
    description: null, organizer_id: null, club_id: null,
    category: 'Academic', cover_image_url: null,
    rsvp_count: 54, capacity: 150, is_public: true,
    map_pin_x: null, map_pin_y: null, map_location_id: null,
  },
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

function mergeWithDemo(real: Event[]): Event[] {
  const realIds = new Set(real.map(e => e.id))
  return [...real, ...DEMO_EVENTS.filter(d => !realIds.has(d.id))]
}

export default function EventsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('upcoming')
  const [events, setEvents] = useState<Event[]>(DEMO_EVENTS)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const theme = useTheme()
  const { onScroll, scrollEventThrottle } = useTabBarScroll()

  useEffect(() => {
    setSelectedDay(null)
    loadTab(activeTab)
  }, [activeTab])

  const loadTab = async (tab: Tab) => {
    setLoading(true)
    try {
      if (tab === 'upcoming') {
        const { data, error: err } = await getEvents({ upcoming: true })
        if (err) throw err
        setEvents(mergeWithDemo(data ?? []))
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
      if (tab === 'upcoming') setEvents(DEMO_EVENTS)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = useCallback(() => { setRefreshing(true); loadTab(activeTab) }, [activeTab])

  const filteredEvents = useMemo(() => {
    if (activeTab !== 'upcoming') return events
    if (selectedDay) return events.filter(e => e.starts_at.slice(0, 10) === selectedDay)
    const yr = viewMonth.getFullYear()
    const mo = String(viewMonth.getMonth() + 1).padStart(2, '0')
    return events.filter(e => e.starts_at.startsWith(`${yr}-${mo}`))
  }, [events, selectedDay, viewMonth, activeTab])

  const listData = useMemo(() => buildListData(filteredEvents), [filteredEvents])

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
    return <EventCard event={item.event} />
  }

  const emptyMessage = activeTab === 'rsvps'
    ? { title: 'No RSVPs yet', sub: 'Browse upcoming events and RSVP!' }
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
    position: 'absolute', bottom: 24, right: 20,
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
