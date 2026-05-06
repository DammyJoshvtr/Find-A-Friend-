import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getEvents, getMyRsvps } from '../../lib/events'
import EventCard from '../../components/events/EventCard'
import { useTheme } from '../../lib/theme'
import type { Event } from '../../lib/events'

type Tab = 'upcoming' | 'rsvps' | 'past'

const TABS: { label: string; value: Tab }[] = [
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'My RSVPs', value: 'rsvps' },
  { label: 'Past', value: 'past' },
]

export default function EventsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('upcoming')
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const theme = useTheme()

  useEffect(() => { loadTab(activeTab) }, [activeTab])

  const loadTab = async (tab: Tab) => {
    setLoading(true)
    setError(null)
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
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = useCallback(() => { setRefreshing(true); loadTab(activeTab) }, [activeTab])

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
            <Text style={[s.tabText, { color: theme.textMuted }, activeTab === tab.value && { color: theme.accent, fontWeight: '600' }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : error ? (
        <View style={s.loadingWrap}>
          <Text style={[s.errorText, { color: theme.textMuted }]}>Failed to load events</Text>
          <TouchableOpacity style={[s.retryBtn, { backgroundColor: theme.accent }]} onPress={() => loadTab(activeTab)}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <EventCard event={item} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="calendar-outline" size={48} color={theme.textFaint} />
              <Text style={[s.emptyTitle, { color: theme.text }]}>
                {activeTab === 'rsvps' ? 'No RSVPs yet' : 'No events found'}
              </Text>
              <Text style={[s.emptyText, { color: theme.textMuted }]}>
                {activeTab === 'rsvps' ? 'Browse upcoming events and RSVP!' : 'Check back soon or create one.'}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 80 }}
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
  title: { fontSize: 22, fontWeight: '700' },
  createBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', borderWidth: 0.5,
  },
  tabBar: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 8,
    borderRadius: 12, padding: 3, borderWidth: 0.5,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabText: { fontSize: 12, fontWeight: '500' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14 },
  retryBtn: { borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  retryText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptyText: { fontSize: 13, textAlign: 'center' },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 54, height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
})
